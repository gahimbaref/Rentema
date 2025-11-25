import { getPool } from '../src/database/connection';

async function checkManager() {
  const pool = getPool();
  
  try {
    const result = await pool.query('SELECT id, email, name FROM property_managers');
    console.log('Property Managers in database:');
    console.log(result.rows);
    
    if (result.rows.length === 0) {
      console.log('\nNo managers found! You need to create a manager account first.');
    }
  } catch (error) {
    console.error('Error checking managers:', error);
  } finally {
    await pool.end();
  }
}

checkManager();
