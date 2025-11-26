import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
});

async function checkEmailWorkflow() {
  try {
    console.log('\n=== Email Workflow Status Check ===\n');

    // Get the most recent inquiry
    const inquiryResult = await pool.query(`
      SELECT id, property_id, prospective_tenant_name, 
             source_metadata->>'tenant_email' as tenant_email, 
             status, created_at
      FROM inquiries
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (inquiryResult.rows.length === 0) {
      console.log('No inquiries found');
      return;
    }

    const inquiry = inquiryResult.rows[0];
    console.log('Most Recent Inquiry:');
    console.log(`  ID: ${inquiry.id}`);
    console.log(`  Tenant: ${inquiry.prospective_tenant_name} (${inquiry.tenant_email})`);
    console.log(`  Status: ${inquiry.status}`);
    console.log(`  Created: ${inquiry.created_at}\n`);

    // Check for questionnaire tokens
    const tokenResult = await pool.query(`
      SELECT id, token, expires_at, used_at, created_at
      FROM questionnaire_tokens
      WHERE inquiry_id = $1
      ORDER BY created_at DESC
    `, [inquiry.id]);

    console.log(`Questionnaire Tokens: ${tokenResult.rows.length}`);
    tokenResult.rows.forEach((token, i) => {
      console.log(`  Token ${i + 1}:`);
      console.log(`    ID: ${token.id}`);
      console.log(`    Token: ${token.token}`);
      console.log(`    Expires: ${token.expires_at}`);
      console.log(`    Used: ${token.used_at || 'Not used'}`);
      console.log(`    Created: ${token.created_at}`);
    });

    // Check for sent emails
    const emailResult = await pool.query(`
      SELECT id, email_type, to_address, sent_at, status, error
      FROM sent_email_logs
      WHERE inquiry_id = $1
      ORDER BY sent_at DESC
    `, [inquiry.id]);

    console.log(`\nSent Emails: ${emailResult.rows.length}`);
    emailResult.rows.forEach((email, i) => {
      console.log(`  Email ${i + 1}:`);
      console.log(`    Type: ${email.email_type}`);
      console.log(`    To: ${email.to_address}`);
      console.log(`    Status: ${email.status}`);
      console.log(`    Sent: ${email.sent_at}`);
      if (email.error) {
        console.log(`    Error: ${email.error}`);
      }
    });

    // Check email templates
    const templateResult = await pool.query(`
      SELECT template_type, subject, is_default
      FROM email_templates
      WHERE template_type = 'initial_questionnaire'
    `);

    console.log(`\nEmail Template Status:`);
    if (templateResult.rows.length > 0) {
      const template = templateResult.rows[0];
      console.log(`  Template: ${template.template_type}`);
      console.log(`  Subject: ${template.subject}`);
      console.log(`  Default: ${template.is_default}`);
    } else {
      console.log('  ❌ No initial_questionnaire template found!');
    }

  } catch (error) {
    console.error('Error checking email workflow:', error);
  } finally {
    await pool.end();
  }
}

checkEmailWorkflow();
