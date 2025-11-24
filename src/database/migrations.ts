import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function runMigrations(pool: Pool): Promise<void> {
  try {
    const schemaPath = join(__dirname, '../../database/schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    
    await pool.query(schema);
    console.log('Database migrations completed successfully');
  } catch (error) {
    console.error('Error running migrations:', error);
    throw error;
  }
}

export async function resetDatabase(pool: Pool): Promise<void> {
  try {
    // Drop all tables in reverse order of dependencies
    await pool.query(`
      DROP TABLE IF EXISTS inquiry_notes CASCADE;
      DROP TABLE IF EXISTS appointments CASCADE;
      DROP TABLE IF EXISTS availability_schedules CASCADE;
      DROP TABLE IF EXISTS message_templates CASCADE;
      DROP TABLE IF EXISTS messages CASCADE;
      DROP TABLE IF EXISTS responses CASCADE;
      DROP TABLE IF EXISTS inquiries CASCADE;
      DROP TABLE IF EXISTS qualification_criteria CASCADE;
      DROP TABLE IF EXISTS questions CASCADE;
      DROP TABLE IF EXISTS platform_connections CASCADE;
      DROP TABLE IF EXISTS properties CASCADE;
      DROP TABLE IF EXISTS property_managers CASCADE;
      DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
    `);
    
    console.log('Database reset completed');
  } catch (error) {
    console.error('Error resetting database:', error);
    throw error;
  }
}
