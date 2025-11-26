import { Pool } from 'pg';
import dotenv from 'dotenv';
import { EmailWorkflowOrchestrator } from '../src/engines/EmailWorkflowOrchestrator';

dotenv.config();

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
});

async function triggerWorkflow() {
  try {
    const inquiryId = 'f66aa5c5-2c5a-4a4e-9ff3-2f90873e6ba7';
    
    console.log('\n=== Triggering Email Workflow ===\n');
    console.log(`Inquiry ID: ${inquiryId}\n`);

    // Get connection ID
    const connectionResult = await pool.query(`
      SELECT id FROM email_connections WHERE is_active = true LIMIT 1
    `);

    if (connectionResult.rows.length === 0) {
      console.log('❌ No active email connection found');
      return;
    }

    const connectionId = connectionResult.rows[0].id;
    console.log(`Using connection ID: ${connectionId}\n`);

    // Create orchestrator and start workflow
    const orchestrator = new EmailWorkflowOrchestrator(pool);
    
    console.log('Starting workflow...\n');
    await orchestrator.startEmailWorkflow(inquiryId, connectionId);
    
    console.log('✅ Workflow started successfully!\n');

    // Check results
    const tokenResult = await pool.query(`
      SELECT token, expires_at FROM questionnaire_tokens
      WHERE inquiry_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [inquiryId]);

    if (tokenResult.rows.length > 0) {
      const token = tokenResult.rows[0];
      console.log('Questionnaire Token Created:');
      console.log(`  Token: ${token.token}`);
      console.log(`  Expires: ${token.expires_at}`);
      console.log(`  Link: ${process.env.CLIENT_URL || 'http://localhost:5173'}/questionnaire/${token.token}\n`);
    }

    const emailResult = await pool.query(`
      SELECT email_type, to_address, status, sent_at
      FROM sent_email_logs
      WHERE inquiry_id = $1
      ORDER BY sent_at DESC
      LIMIT 1
    `, [inquiryId]);

    if (emailResult.rows.length > 0) {
      const email = emailResult.rows[0];
      console.log('Email Sent:');
      console.log(`  Type: ${email.email_type}`);
      console.log(`  To: ${email.to_address}`);
      console.log(`  Status: ${email.status}`);
      console.log(`  Sent: ${email.sent_at}\n`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

triggerWorkflow();
