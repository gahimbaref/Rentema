import { getPool } from '../src/database/connection';

async function createTestManager() {
  const pool = getPool();
  
  try {
    console.log('Creating test manager...');
    
    const result = await pool.query(`
      INSERT INTO property_managers (id, email, name, created_at, updated_at)
      VALUES (
        '00000000-0000-0000-0000-000000000001',
        'dev@rentema.local',
        'Development Manager',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (id) DO NOTHING
      RETURNING id, email, name;
    `);
    
    if (result.rows.length > 0) {
      console.log('✓ Test manager created successfully:');
      console.log(result.rows[0]);
    } else {
      console.log('✓ Test manager already exists');
      
      // Show existing manager
      const existing = await pool.query(
        "SELECT id, email, name FROM property_managers WHERE id = '00000000-0000-0000-0000-000000000001'"
      );
      console.log(existing.rows[0]);
    }
  } catch (error) {
    console.error('Error creating test manager:', error);
  } finally {
    await pool.end();
  }
}

createTestManager();
