import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD
});

async function checkData() {
  try {
    console.log('\n=== Properties ===');
    const properties = await pool.query('SELECT id, address, manager_id FROM properties LIMIT 5');
    console.log(JSON.stringify(properties.rows, null, 2));

    console.log('\n=== Recent Processed Emails ===');
    const emails = await pool.query(`
      SELECT email_id, subject, "from", platform_type, processing_status, inquiry_id
      FROM processed_emails 
      ORDER BY received_date DESC 
      LIMIT 5
    `);
    console.log(JSON.stringify(emails.rows, null, 2));

    console.log('\n=== Recent Inquiries ===');
    const inquiries = await pool.query(`
      SELECT i.id, i.property_id, i.status, i.source_metadata->>'propertyAddress' as property_address,
             i.source_metadata->>'propertyReference' as property_reference,
             p.address as matched_property_address
      FROM inquiries i
      LEFT JOIN properties p ON i.property_id = p.id
      ORDER BY i.created_at DESC
      LIMIT 5
    `);
    console.log(JSON.stringify(inquiries.rows, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkData();
