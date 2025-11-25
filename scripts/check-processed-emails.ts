import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function checkProcessedEmails() {
  const pool = new Pool({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME || 'rentema',
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD
  });
  
  try {
    console.log('\n=== Checking Processed Emails ===\n');
    
    // Get all processed emails
    const result = await pool.query(`
      SELECT 
        id,
        email_id,
        "from",
        subject,
        LEFT(body, 150) as body_preview,
        platform_type,
        processing_status,
        parsing_errors,
        inquiry_id,
        received_date,
        processed_at
      FROM processed_emails 
      ORDER BY received_date DESC 
      LIMIT 10
    `);
    
    console.log(`Found ${result.rows.length} processed emails:\n`);
    
    for (const email of result.rows) {
      console.log('---');
      console.log(`ID: ${email.id}`);
      console.log(`Email ID: ${email.email_id}`);
      console.log(`From: ${email.from}`);
      console.log(`Subject: ${email.subject}`);
      console.log(`Body Preview: ${email.body_preview}`);
      console.log(`Platform Type: ${email.platform_type || 'NOT SET'}`);
      console.log(`Processing Status: ${email.processing_status}`);
      console.log(`Inquiry ID: ${email.inquiry_id || 'NONE'}`);
      console.log(`Parsing Errors: ${email.parsing_errors || 'NONE'}`);
      console.log(`Received: ${email.received_date}`);
      console.log(`Processed: ${email.processed_at || 'NOT PROCESSED'}`);
      console.log('');
    }
    
    // Check properties
    console.log('\n=== Checking Properties ===\n');
    const propsResult = await pool.query(`
      SELECT id, address, manager_id, is_archived
      FROM properties
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    console.log(`Found ${propsResult.rows.length} properties:\n`);
    for (const prop of propsResult.rows) {
      console.log(`- ${prop.address} (ID: ${prop.id}, Archived: ${prop.is_archived})`);
    }
    
    // Check inquiries
    console.log('\n=== Checking Inquiries ===\n');
    const inquiriesResult = await pool.query(`
      SELECT id, property_id, source_email_id, status, created_at
      FROM inquiries
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    console.log(`Found ${inquiriesResult.rows.length} inquiries:\n`);
    for (const inq of inquiriesResult.rows) {
      console.log(`- Inquiry ${inq.id}`);
      console.log(`  Property: ${inq.property_id}`);
      console.log(`  Source Email: ${inq.source_email_id || 'NONE'}`);
      console.log(`  Status: ${inq.status}`);
      console.log(`  Created: ${inq.created_at}`);
      console.log('');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkProcessedEmails();
