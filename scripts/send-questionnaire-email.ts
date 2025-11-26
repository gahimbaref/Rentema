/**
 * Send questionnaire email directly for testing
 * Bypasses the full workflow to test email sending
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { google } from 'googleapis';
import { decryptCredentials } from '../src/database/encryption';

dotenv.config();

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
});

async function sendQuestionnaireEmail() {
  try {
    const inquiryId = 'f66aa5c5-2c5a-4a4e-9ff3-2f90873e6ba7';
    
    console.log('\n=== Sending Questionnaire Email ===\n');

    // 1. Get inquiry and token
    const inquiryResult = await pool.query(`
      SELECT 
        i.*,
        p.address as property_address,
        p.manager_id,
        qt.token
      FROM inquiries i
      LEFT JOIN properties p ON i.property_id = p.id
      LEFT JOIN questionnaire_tokens qt ON i.id = qt.inquiry_id
      WHERE i.id = $1
      ORDER BY qt.created_at DESC
      LIMIT 1
    `, [inquiryId]);

    if (inquiryResult.rows.length === 0) {
      console.log('❌ Inquiry not found');
      return;
    }

    const inquiry = inquiryResult.rows[0];
    const tenantEmail = inquiry.source_metadata?.tenantEmail;
    const tenantName = inquiry.prospective_tenant_name || 'there';
    const propertyAddress = inquiry.property_address || 'the property';
    const token = inquiry.token;

    if (!token) {
      console.log('❌ No questionnaire token found');
      console.log('   Run: npx ts-node scripts/manual-trigger-workflow.ts');
      return;
    }

    if (!tenantEmail) {
      console.log('❌ No tenant email found');
      return;
    }

    console.log(`To: ${tenantEmail}`);
    console.log(`Tenant: ${tenantName}`);
    console.log(`Property: ${propertyAddress}\n`);

    // 2. Get email connection
    const connectionResult = await pool.query(`
      SELECT id, access_token, refresh_token
      FROM email_connections
      WHERE is_active = true
      LIMIT 1
    `);

    if (connectionResult.rows.length === 0) {
      console.log('❌ No active email connection found');
      return;
    }

    const connection = connectionResult.rows[0];
    console.log(`Using connection: ${connection.id}\n`);

    // 3. Decrypt tokens
    const accessTokenData = decryptCredentials(connection.access_token);
    const refreshTokenData = decryptCredentials(connection.refresh_token);
    const accessToken = accessTokenData.token;
    const refreshToken = refreshTokenData.token;

    // 4. Get email template
    const templateResult = await pool.query(`
      SELECT subject, html_body, plain_text_body
      FROM email_templates
      WHERE template_type = 'questionnaire'
      LIMIT 1
    `);

    if (templateResult.rows.length === 0) {
      console.log('❌ No questionnaire template found');
      return;
    }

    const template = templateResult.rows[0];

    // 5. Build questionnaire link
    const questionnaireLink = `${process.env.CLIENT_URL || 'http://localhost:5173'}/questionnaire/${token}`;
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 7);
    const expirationDateStr = expirationDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    // 6. Render template
    const data = {
      tenantName,
      propertyAddress,
      questionnaireLink,
      expirationDate: expirationDateStr,
      managerName: 'Property Manager',
      managerEmail: process.env.MANAGER_EMAIL || 'manager@example.com',
      managerPhone: process.env.MANAGER_PHONE || '(555) 123-4567',
    };

    let subject = template.subject;
    let htmlBody = template.html_body;
    let plainTextBody = template.plain_text_body;

    for (const [key, value] of Object.entries(data)) {
      const placeholder = new RegExp(`{{${key}}}`, 'g');
      subject = subject.replace(placeholder, String(value));
      htmlBody = htmlBody.replace(placeholder, String(value));
      plainTextBody = plainTextBody.replace(placeholder, String(value));
    }

    console.log(`Subject: ${subject}\n`);

    // 7. Create Gmail client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // 8. Create MIME message
    const boundary = '----=_Part_' + Date.now();
    const message = [
      `To: ${tenantEmail}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      '',
      plainTextBody,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      '',
      htmlBody,
      '',
      `--${boundary}--`,
    ].join('\r\n');

    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // 9. Send email
    console.log('Sending email...\n');
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });

    console.log('✅ Email sent successfully!');
    console.log(`   Gmail Message ID: ${response.data.id}\n`);

    // 10. Update sent_email_logs
    await pool.query(`
      UPDATE sent_email_logs
      SET status = 'sent', gmail_message_id = $1
      WHERE inquiry_id = $2 AND email_type = 'questionnaire'
    `, [response.data.id, inquiryId]);

    console.log('✅ Email log updated\n');

    console.log('=== Summary ===\n');
    console.log(`✅ Questionnaire email sent to ${tenantEmail}`);
    console.log(`📧 Check your inbox for the email`);
    console.log(`🔗 Questionnaire link: ${questionnaireLink}`);
    console.log('');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
  } finally {
    await pool.end();
  }
}

sendQuestionnaireEmail();
