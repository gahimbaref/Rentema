import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function debugEmailPolling() {
  const pool = new Pool({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
  });

  try {
    console.log('=== Email Polling Debug ===\n');

    // Check processed emails
    console.log('Recent processed emails:');
    const processedResult = await pool.query(`
      SELECT 
        id,
        email_id,
        subject,
        "from",
        received_date,
        platform_type,
        inquiry_id,
        processing_status,
        parsing_errors,
        processed_at
      FROM processed_emails
      ORDER BY processed_at DESC
      LIMIT 5
    `);

    if (processedResult.rows.length === 0) {
      console.log('  No processed emails found\n');
    } else {
      processedResult.rows.forEach((email, index) => {
        console.log(`\n${index + 1}. Email ID: ${email.id}`);
        console.log(`   Gmail ID: ${email.email_id}`);
        console.log(`   Subject: ${email.subject}`);
        console.log(`   From: ${email.from}`);
        console.log(`   Received: ${email.received_date}`);
        console.log(`   Platform: ${email.platform_type || 'NOT MATCHED'}`);
        console.log(`   Inquiry: ${email.inquiry_id || 'NOT CREATED'}`);
        console.log(`   Status: ${email.processing_status}`);
        console.log(`   Errors: ${email.parsing_errors ? JSON.stringify(email.parsing_errors) : 'None'}`);
        console.log(`   Processed: ${email.processed_at}`);
      });
    }

    // Check platform patterns
    console.log('\n\nConfigured platform patterns:');
    const patternsResult = await pool.query(`
      SELECT platform_type, sender_pattern, subject_pattern, is_active, priority
      FROM platform_patterns
      ORDER BY priority DESC, platform_type
    `);

    if (patternsResult.rows.length === 0) {
      console.log('  ⚠️  NO PLATFORM PATTERNS CONFIGURED!\n');
    } else {
      patternsResult.rows.forEach(pattern => {
        console.log(`\n  ${pattern.platform_type} (Priority: ${pattern.priority}, Active: ${pattern.is_active}):`);
        console.log(`    Sender: ${pattern.sender_pattern}`);
        console.log(`    Subject: ${pattern.subject_pattern || 'Any'}`);
      });
    }

    // Check properties
    console.log('\n\nConfigured properties:');
    const propertiesResult = await pool.query(`
      SELECT id, address, is_archived
      FROM properties
      WHERE is_archived = false
      ORDER BY created_at DESC
    `);

    if (propertiesResult.rows.length === 0) {
      console.log('  ⚠️  NO ACTIVE PROPERTIES CONFIGURED!\n');
    } else {
      propertiesResult.rows.forEach(prop => {
        console.log(`  - ${prop.address} (ID: ${prop.id})`);
      });
    }

    // Check email filters
    console.log('\n\nEmail filter configuration:');
    const filtersResult = await pool.query(`
      SELECT 
        connection_id,
        enabled,
        from_filter,
        subject_filter,
        date_filter_start
      FROM email_filter_configs
    `);

    if (filtersResult.rows.length === 0) {
      console.log('  No filters configured (all emails will be processed)\n');
    } else {
      filtersResult.rows.forEach(filter => {
        console.log(`\n  Connection: ${filter.connection_id}`);
        console.log(`    Enabled: ${filter.enabled}`);
        console.log(`    From filter: ${filter.from_filter || 'None'}`);
        console.log(`    Subject filter: ${filter.subject_filter || 'None'}`);
        console.log(`    Date filter: ${filter.date_filter_start || 'None'}`);
      });
    }

    // Check recent inquiries
    console.log('\n\nRecent inquiries:');
    const inquiriesResult = await pool.query(`
      SELECT 
        id,
        prospective_tenant_name,
        status,
        source_type,
        created_at
      FROM inquiries
      ORDER BY created_at DESC
      LIMIT 5
    `);

    if (inquiriesResult.rows.length === 0) {
      console.log('  No inquiries found\n');
    } else {
      inquiriesResult.rows.forEach((inquiry, index) => {
        console.log(`\n${index + 1}. ${inquiry.prospective_tenant_name || 'Unknown'}`);
        console.log(`   Status: ${inquiry.status}`);
        console.log(`   Source: ${inquiry.source_type}`);
        console.log(`   Created: ${inquiry.created_at}`);
      });
    }

  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

debugEmailPolling();
