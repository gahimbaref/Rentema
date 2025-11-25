import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function checkPlatformPatterns() {
  const pool = new Pool({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME || 'rentema',
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD
  });
  
  try {
    console.log('\n=== Checking Platform Patterns ===\n');
    
    const result = await pool.query(`
      SELECT 
        id,
        platform_type,
        sender_pattern,
        subject_pattern,
        priority,
        is_active,
        created_at
      FROM platform_patterns 
      ORDER BY priority ASC, platform_type ASC
    `);
    
    console.log(`Found ${result.rows.length} platform patterns:\n`);
    
    for (const pattern of result.rows) {
      console.log('---');
      console.log(`Platform Type: ${pattern.platform_type}`);
      console.log(`Sender Pattern: ${pattern.sender_pattern}`);
      console.log(`Subject Pattern: ${pattern.subject_pattern || 'NONE'}`);
      console.log(`Priority: ${pattern.priority}`);
      console.log(`Active: ${pattern.is_active}`);
      console.log(`Created: ${pattern.created_at}`);
      console.log('');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkPlatformPatterns();
