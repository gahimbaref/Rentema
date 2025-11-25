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
    // Drop all tables, triggers, and functions in reverse order of dependencies
    await pool.query(`
      -- Drop triggers first
      DROP TRIGGER IF EXISTS update_property_managers_updated_at ON property_managers CASCADE;
      DROP TRIGGER IF EXISTS update_properties_updated_at ON properties CASCADE;
      DROP TRIGGER IF EXISTS update_platform_connections_updated_at ON platform_connections CASCADE;
      DROP TRIGGER IF EXISTS update_email_connections_updated_at ON email_connections CASCADE;
      DROP TRIGGER IF EXISTS update_platform_patterns_updated_at ON platform_patterns CASCADE;
      DROP TRIGGER IF EXISTS update_email_filter_configs_updated_at ON email_filter_configs CASCADE;
      DROP TRIGGER IF EXISTS update_inquiries_updated_at ON inquiries CASCADE;
      DROP TRIGGER IF EXISTS update_message_templates_updated_at ON message_templates CASCADE;
      DROP TRIGGER IF EXISTS update_availability_schedules_updated_at ON availability_schedules CASCADE;
      DROP TRIGGER IF EXISTS update_appointments_updated_at ON appointments CASCADE;
      
      -- Drop indexes
      DROP INDEX IF EXISTS idx_properties_manager CASCADE;
      DROP INDEX IF EXISTS idx_properties_archived CASCADE;
      DROP INDEX IF EXISTS idx_inquiries_property CASCADE;
      DROP INDEX IF EXISTS idx_inquiries_status CASCADE;
      DROP INDEX IF EXISTS idx_inquiries_created CASCADE;
      DROP INDEX IF EXISTS idx_inquiries_source_email_id CASCADE;
      DROP INDEX IF EXISTS idx_messages_inquiry CASCADE;
      DROP INDEX IF EXISTS idx_responses_inquiry CASCADE;
      DROP INDEX IF EXISTS idx_appointments_inquiry CASCADE;
      DROP INDEX IF EXISTS idx_appointments_scheduled_time CASCADE;
      DROP INDEX IF EXISTS idx_questions_property CASCADE;
      DROP INDEX IF EXISTS idx_email_connections_manager CASCADE;
      DROP INDEX IF EXISTS idx_email_connections_active CASCADE;
      DROP INDEX IF EXISTS idx_processed_emails_connection CASCADE;
      DROP INDEX IF EXISTS idx_processed_emails_email_id CASCADE;
      
      -- Drop tables
      DROP TABLE IF EXISTS inquiry_notes CASCADE;
      DROP TABLE IF EXISTS appointments CASCADE;
      DROP TABLE IF EXISTS availability_schedules CASCADE;
      DROP TABLE IF EXISTS message_templates CASCADE;
      DROP TABLE IF EXISTS messages CASCADE;
      DROP TABLE IF EXISTS responses CASCADE;
      DROP TABLE IF EXISTS inquiries CASCADE;
      DROP TABLE IF EXISTS qualification_criteria CASCADE;
      DROP TABLE IF EXISTS questions CASCADE;
      DROP TABLE IF EXISTS processed_emails CASCADE;
      DROP TABLE IF EXISTS email_filter_configs CASCADE;
      DROP TABLE IF EXISTS platform_patterns CASCADE;
      DROP TABLE IF EXISTS email_connections CASCADE;
      DROP TABLE IF EXISTS platform_connections CASCADE;
      DROP TABLE IF EXISTS properties CASCADE;
      DROP TABLE IF EXISTS property_managers CASCADE;
      
      -- Drop functions
      DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
    `);
    
    console.log('Database reset completed');
  } catch (error) {
    console.error('Error resetting database:', error);
    throw error;
  }
}
