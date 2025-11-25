import { getDatabasePool } from '../src/database/connection';

async function main() {
  console.log('Adding body column to processed_emails table...');
  
  const pool = getDatabasePool();
  
  try {
    await pool.query(`
      ALTER TABLE processed_emails 
      ADD COLUMN IF NOT EXISTS body TEXT;
    `);
    console.log('✓ Body column added successfully');
  } catch (error) {
    console.error('Error adding column:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
