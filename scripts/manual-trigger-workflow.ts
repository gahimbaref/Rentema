/**
 * Manually trigger email workflow for an existing inquiry
 * This bypasses TypeScript compilation issues by using direct database queries
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
});

async function manualTrigger() {
  try {
    const inquiryId = 'f66aa5c5-2c5a-4a4e-9ff3-2f90873e6ba7';
    
    console.log('\n=== Manually Triggering Email Workflow ===\n');
    console.log(`Inquiry ID: ${inquiryId}\n`);

    // 1. Get inquiry details
    const inquiryResult = await pool.query(`
      SELECT i.*, p.address as property_address, p.manager_id
      FROM inquiries i
      LEFT JOIN properties p ON i.property_id = p.id
      WHERE i.id = $1
    `, [inquiryId]);

    if (inquiryResult.rows.length === 0) {
      console.log('❌ Inquiry not found');
      return;
    }

    const inquiry = inquiryResult.rows[0];
    const tenantEmail = inquiry.source_metadata?.tenantEmail;
    const tenantName = inquiry.prospective_tenant_name || 'there';
    const propertyAddress = inquiry.property_address || 'the property';
    const managerId = inquiry.manager_id;

    console.log(`Tenant: ${tenantName} (${tenantEmail})`);
    console.log(`Property: ${propertyAddress}`);
    console.log(`Manager ID: ${managerId}\n`);

    if (!tenantEmail) {
      console.log('❌ No tenant email found in inquiry metadata');
      return;
    }

    if (!managerId) {
      console.log('❌ No manager ID found');
      return;
    }

    // 2. Create questionnaire token
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    await pool.query(`
      INSERT INTO questionnaire_tokens (inquiry_id, token, expires_at)
      VALUES ($1, $2, $3)
    `, [inquiryId, token, expiresAt]);

    console.log('✓ Created questionnaire token');
    console.log(`  Token: ${token}`);
    console.log(`  Expires: ${expiresAt.toLocaleDateString()}\n`);

    // 3. Get questionnaire link
    const questionnaireLink = `${process.env.CLIENT_URL || 'http://localhost:5173'}/questionnaire/${token}`;
    console.log(`Questionnaire Link: ${questionnaireLink}\n`);

    // 4. Log that email would be sent (we won't actually send it due to compilation issues)
    console.log('📧 Email would be sent to:', tenantEmail);
    console.log('   Subject: Quick Questions About', propertyAddress);
    console.log('   Template: questionnaire\n');

    // 5. Create a sent_email_log entry (marking as pending since we're not actually sending)
    const connectionResult = await pool.query(`
      SELECT id FROM email_connections WHERE is_active = true LIMIT 1
    `);

    if (connectionResult.rows.length > 0) {
      const connectionId = connectionResult.rows[0].id;
      
      await pool.query(`
        INSERT INTO sent_email_logs (
          inquiry_id,
          connection_id,
          email_type,
          to_address,
          subject,
          status
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        inquiryId,
        connectionId,
        'questionnaire',
        tenantEmail,
        `Quick Questions About ${propertyAddress}`,
        'pending' // Mark as pending since we're not actually sending
      ]);

      console.log('✓ Created email log entry (status: pending)\n');
    }

    // 6. Update inquiry status
    await pool.query(`
      UPDATE inquiries
      SET status = 'pre_qualifying', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [inquiryId]);

    console.log('✓ Updated inquiry status to: pre_qualifying\n');

    console.log('=== Summary ===\n');
    console.log('✅ Workflow setup complete!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Fix the TypeScript compilation errors in the codebase');
    console.log('2. Test the questionnaire link:', questionnaireLink);
    console.log('3. Once code is fixed, emails will be sent automatically for new inquiries');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

manualTrigger();
