import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function checkInquiryMetadata() {
  const pool = new Pool({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
  });

  try {
    const result = await pool.query(
      'SELECT id, source_metadata, source_type FROM inquiries WHERE id = $1',
      ['43c1b7a4-b7c8-47fe-86e2-56ee845f434e']
    );

    console.log('Inquiry metadata:');
    console.log(JSON.stringify(result.rows[0], null, 2));

    // Also check email connections
    const connections = await pool.query('SELECT id, email_address FROM email_connections');
    console.log('\nAvailable email connections:');
    console.log(JSON.stringify(connections.rows, null, 2));

    // Check if the specific connection exists
    const specificConnection = await pool.query(
      'SELECT * FROM email_connections WHERE id = $1',
      ['e9eab642-2e44-4115-9b71-26dd62f41804']
    );
    console.log('\nSpecific connection from inquiry:');
    console.log(JSON.stringify(specificConnection.rows, null, 2));

  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkInquiryMetadata();
