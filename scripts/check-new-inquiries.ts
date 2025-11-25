import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function checkNewInquiries() {
  const pool = new Pool({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME || 'rentema',
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD
  });
  
  try {
    console.log('\n=== Checking Recent Inquiries ===\n');
    
    const result = await pool.query(`
      SELECT 
        i.id,
        i.property_id,
        i.prospective_tenant_name,
        i.status,
        i.source_email_id,
        i.source_metadata,
        i.created_at,
        p.address as property_address
      FROM inquiries i
      LEFT JOIN properties p ON i.property_id = p.id
      ORDER BY i.created_at DESC
      LIMIT 5
    `);
    
    console.log(`Found ${result.rows.length} recent inquiries:\n`);
    
    for (const inquiry of result.rows) {
      console.log('---');
      console.log(`Inquiry ID: ${inquiry.id}`);
      console.log(`Property: ${inquiry.property_address || 'UNKNOWN'}`);
      console.log(`Tenant Name: ${inquiry.prospective_tenant_name || 'UNKNOWN'}`);
      console.log(`Status: ${inquiry.status}`);
      console.log(`Source Email ID: ${inquiry.source_email_id || 'NONE'}`);
      console.log(`Created: ${inquiry.created_at}`);
      
      if (inquiry.source_metadata) {
        const metadata = inquiry.source_metadata;
        console.log(`\nMetadata:`);
        console.log(`  Platform Type: ${metadata.platformType || 'UNKNOWN'}`);
        console.log(`  Tenant Email: ${metadata.tenantEmail || 'UNKNOWN'}`);
        console.log(`  Tenant Phone: ${metadata.tenantPhone || 'UNKNOWN'}`);
        console.log(`  Property Address: ${metadata.propertyAddress || 'UNKNOWN'}`);
        console.log(`  Message: ${metadata.message ? metadata.message.substring(0, 100) + '...' : 'NONE'}`);
      }
      console.log('');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkNewInquiries();
