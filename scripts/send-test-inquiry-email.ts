import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { google } from 'googleapis';

dotenv.config();

async function sendTestInquiryEmail() {
  const pool = new Pool({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
  });

  try {
    // Get email connection
    const connectionResult = await pool.query(`
      SELECT id, email_address, refresh_token
      FROM email_connections
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (connectionResult.rows.length === 0) {
      console.error('No email connection found. Please connect your Gmail account first.');
      return;
    }

    const connection = connectionResult.rows[0];
    console.log('Using email connection:', connection.email_address);

    // Get active properties
    const propertiesResult = await pool.query(`
      SELECT address
      FROM properties
      WHERE is_archived = false
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (propertiesResult.rows.length === 0) {
      console.error('No active properties found. Please create a property first.');
      return;
    }

    const propertyAddress = propertiesResult.rows[0].address;
    console.log('Using property:', propertyAddress);

    // Set up Gmail API
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      refresh_token: connection.refresh_token,
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Create email content
    const subject = `Rental Inquiry for ${propertyAddress}`;
    const body = `Hi,

I'm very interested in renting the property at ${propertyAddress}.

My name is Jane Smith
Email: jane.smith@example.com
Phone: (555) 987-6543

I'm looking for a place to move in next month. Could you please provide more information about:
- Availability date
- Monthly rent
- Lease terms
- Pet policy

I'm happy to schedule a viewing at your earliest convenience.

Thank you for your time!

Best regards,
Jane Smith`;

    // Create the email in RFC 2822 format
    const email = [
      `To: ${connection.email_address}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      body,
    ].join('\n');

    // Encode the email in base64url format
    const encodedEmail = Buffer.from(email)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Send the email
    console.log('\nSending test inquiry email...');
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedEmail,
      },
    });

    console.log('✅ Email sent successfully!');
    console.log('Message ID:', response.data.id);
    console.log('\nEmail details:');
    console.log('  To:', connection.email_address);
    console.log('  Subject:', subject);
    console.log('  Property:', propertyAddress);
    console.log('\nThe email should be picked up by the poller within 1 minute.');
    console.log('Check the inquiries page to see the new inquiry.');

  } catch (error: any) {
    console.error('Error sending test email:', error.message);
    if (error.response) {
      console.error('API Error:', error.response.data);
    }
  } finally {
    await pool.end();
  }
}

sendTestInquiryEmail();
