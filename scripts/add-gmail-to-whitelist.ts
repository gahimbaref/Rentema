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

async function addGmailToWhitelist() {
  try {
    // Get current whitelist
    const current = await pool.query(`
      SELECT sender_whitelist 
      FROM email_filter_configs 
      WHERE connection_id = '09a173b5-5a94-49aa-ab02-3fb956062159'
    `);
    
    const whitelist = current.rows[0].sender_whitelist;
    if (!whitelist.includes('gmail.com')) {
      whitelist.push('gmail.com');
      
      await pool.query(`
        UPDATE email_filter_configs 
        SET sender_whitelist = $1
        WHERE connection_id = '09a173b5-5a94-49aa-ab02-3fb956062159'
      `, [JSON.stringify(whitelist)]);
      
      console.log('✓ Added gmail.com to sender whitelist');
    } else {
      console.log('gmail.com already in whitelist');
    }
    
    // Show updated config
    const result = await pool.query(`
      SELECT sender_whitelist 
      FROM email_filter_configs 
      WHERE connection_id = '09a173b5-5a94-49aa-ab02-3fb956062159'
    `);
    
    console.log('\nUpdated whitelist:', result.rows[0].sender_whitelist);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

addGmailToWhitelist();
