import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function checkPlatforms() {
  const pool = new Pool({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME || 'rentema',
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD
  });
  
  try {
    console.log('\n=== Checking Platform Connections ===\n');
    
    const result = await pool.query(`
      SELECT 
        id,
        manager_id,
        platform_type,
        credentials,
        is_active,
        created_at
      FROM platform_connections
      ORDER BY created_at DESC
    `);
    
    console.log(`Found ${result.rows.length} platform connections:\n`);
    
    for (const platform of result.rows) {
      console.log('---');
      console.log(`ID: ${platform.id}`);
      console.log(`Manager ID: ${platform.manager_id}`);
      console.log(`Platform Type: ${platform.platform_type}`);
      console.log(`Credentials: ${platform.credentials || 'NULL/EMPTY'}`);
      console.log(`Active: ${platform.is_active}`);
      console.log(`Created: ${platform.created_at}`);
      console.log('');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkPlatforms();
