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

async function checkInquiryDetails() {
  try {
    const inquiryId = 'f66aa5c5-2c5a-4a4e-9ff3-2f90873e6ba7';
    
    const result = await pool.query(`
      SELECT 
        id,
        property_id,
        prospective_tenant_name,
        status,
        source_type,
        source_email_id,
        source_metadata,
        created_at
      FROM inquiries
      WHERE id = $1
    `, [inquiryId]);

    if (result.rows.length === 0) {
      console.log('Inquiry not found');
      return;
    }

    const inquiry = result.rows[0];
    console.log('\n=== Inquiry Details ===\n');
    console.log('ID:', inquiry.id);
    console.log('Property ID:', inquiry.property_id);
    console.log('Tenant:', inquiry.prospective_tenant_name);
    console.log('Status:', inquiry.status);
    console.log('Source Type:', inquiry.source_type);
    console.log('Source Email ID:', inquiry.source_email_id);
    console.log('Source Metadata:', JSON.stringify(inquiry.source_metadata, null, 2));
    console.log('Created:', inquiry.created_at);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkInquiryDetails();
