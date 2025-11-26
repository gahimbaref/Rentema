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

async function testEmailSetup() {
  try {
    console.log('\n=== Email Workflow Setup Test ===\n');

    // 1. Check if email templates exist
    const templateResult = await pool.query(`
      SELECT template_type, subject, is_default
      FROM email_templates
      WHERE template_type = 'questionnaire'
    `);

    console.log('1. Email Templates:');
    if (templateResult.rows.length > 0) {
      console.log('   ✓ Questionnaire template exists');
      console.log(`     Subject: ${templateResult.rows[0].subject}`);
    } else {
      console.log('   ❌ No questionnaire template found');
      console.log('   Run: npx ts-node scripts/seed-email-templates.ts');
    }

    // 2. Check if email connection exists
    const connectionResult = await pool.query(`
      SELECT id, email_address, is_active
      FROM email_connections
      WHERE is_active = true
      LIMIT 1
    `);

    console.log('\n2. Email Connection:');
    if (connectionResult.rows.length > 0) {
      console.log('   ✓ Active email connection found');
      console.log(`     Email: ${connectionResult.rows[0].email_address}`);
      console.log(`     ID: ${connectionResult.rows[0].id}`);
    } else {
      console.log('   ❌ No active email connection found');
      console.log('   You need to connect Gmail via the UI');
    }

    // 3. Check the inquiry
    const inquiryId = 'f66aa5c5-2c5a-4a4e-9ff3-2f90873e6ba7';
    const inquiryResult = await pool.query(`
      SELECT 
        id,
        property_id,
        prospective_tenant_name,
        status,
        source_type,
        source_metadata
      FROM inquiries
      WHERE id = $1
    `, [inquiryId]);

    console.log('\n3. Inquiry Status:');
    if (inquiryResult.rows.length > 0) {
      const inquiry = inquiryResult.rows[0];
      console.log('   ✓ Inquiry found');
      console.log(`     Tenant: ${inquiry.prospective_tenant_name}`);
      console.log(`     Status: ${inquiry.status}`);
      console.log(`     Source: ${inquiry.source_type}`);
      console.log(`     Email: ${inquiry.source_metadata?.tenantEmail || 'NOT FOUND'}`);
    } else {
      console.log('   ❌ Inquiry not found');
    }

    // 4. Check if workflow was triggered
    const tokenResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM questionnaire_tokens
      WHERE inquiry_id = $1
    `, [inquiryId]);

    console.log('\n4. Workflow Status:');
    const tokenCount = parseInt(tokenResult.rows[0].count);
    if (tokenCount > 0) {
      console.log(`   ✓ Questionnaire token created (${tokenCount} token(s))`);
    } else {
      console.log('   ❌ No questionnaire token created');
      console.log('   The workflow was not triggered');
    }

    const emailResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM sent_email_logs
      WHERE inquiry_id = $1
    `, [inquiryId]);

    const emailCount = parseInt(emailResult.rows[0].count);
    if (emailCount > 0) {
      console.log(`   ✓ Email sent (${emailCount} email(s))`);
    } else {
      console.log('   ❌ No email sent');
    }

    console.log('\n=== Summary ===\n');
    
    if (templateResult.rows.length === 0) {
      console.log('❌ Missing email templates - run seed script');
    } else if (connectionResult.rows.length === 0) {
      console.log('❌ Missing email connection - connect Gmail in UI');
    } else if (tokenCount === 0) {
      console.log('❌ Workflow not triggered - there may be a code issue');
      console.log('   The inquiry exists but processNewInquiry was not called or failed');
    } else {
      console.log('✅ Everything looks good!');
    }

    console.log('');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

testEmailSetup();
