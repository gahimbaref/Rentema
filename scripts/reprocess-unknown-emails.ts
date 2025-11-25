import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function reprocessUnknownEmails() {
  const pool = new Pool({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME || 'rentema',
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD
  });
  
  try {
    console.log('\n=== Reprocessing Unknown Emails ===\n');
    
    // Reset unknown emails to pending
    const result = await pool.query(
      `UPDATE processed_emails 
       SET processing_status = 'pending', 
           platform_type = NULL,
           processed_at = NULL
       WHERE platform_type = 'unknown' OR processing_status = 'skipped'
       RETURNING id, email_id, "from", subject`
    );
    
    console.log(`Reset ${result.rows.length} emails to pending status:\n`);
    
    for (const email of result.rows) {
      console.log(`- ${email.from}: ${email.subject}`);
    }
    
    console.log('\nEmails will be reprocessed on next poll cycle');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

reprocessUnknownEmails();
