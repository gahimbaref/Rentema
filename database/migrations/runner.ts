import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Run all email integration migrations in order
 */
export async function runEmailIntegrationMigrations(pool: Pool): Promise<void> {
  const migrations = [
    '001_create_email_connections.sql',
    '002_create_platform_patterns.sql',
    '003_create_email_filter_configs.sql',
    '004_create_processed_emails.sql',
    '005_update_inquiries_for_email_source.sql',
    '006_create_notifications.sql',
  ];

  console.log('Starting email integration migrations...');

  for (const migration of migrations) {
    try {
      console.log(`Running migration: ${migration}`);
      const migrationPath = join(__dirname, migration);
      const sql = readFileSync(migrationPath, 'utf-8');
      
      await pool.query(sql);
      console.log(`✓ Completed: ${migration}`);
    } catch (error) {
      console.error(`✗ Failed: ${migration}`);
      console.error(error);
      throw error;
    }
  }

  console.log('All email integration migrations completed successfully');
}

/**
 * Run a specific migration by name
 */
export async function runMigration(pool: Pool, migrationName: string): Promise<void> {
  try {
    console.log(`Running migration: ${migrationName}`);
    const migrationPath = join(__dirname, migrationName);
    const sql = readFileSync(migrationPath, 'utf-8');
    
    await pool.query(sql);
    console.log(`✓ Completed: ${migrationName}`);
  } catch (error) {
    console.error(`✗ Failed: ${migrationName}`);
    console.error(error);
    throw error;
  }
}

/**
 * Verify email integration tables exist
 */
export async function verifyEmailIntegrationTables(pool: Pool): Promise<boolean> {
  try {
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN (
        'email_connections',
        'platform_patterns',
        'email_filter_configs',
        'processed_emails',
        'notifications'
      )
      ORDER BY table_name;
    `);

    const expectedTables = [
      'email_connections',
      'email_filter_configs',
      'notifications',
      'platform_patterns',
      'processed_emails',
    ];

    const actualTables = result.rows.map(row => row.table_name);
    const allTablesExist = expectedTables.every(table => actualTables.includes(table));

    if (allTablesExist) {
      console.log('✓ All email integration tables exist');
      return true;
    } else {
      const missingTables = expectedTables.filter(table => !actualTables.includes(table));
      console.log('✗ Missing tables:', missingTables);
      return false;
    }
  } catch (error) {
    console.error('Error verifying tables:', error);
    return false;
  }
}

/**
 * Verify inquiries table has email source columns
 */
export async function verifyInquiriesColumns(pool: Pool): Promise<boolean> {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'inquiries' 
      AND column_name IN ('source_type', 'source_email_id', 'source_metadata')
      ORDER BY column_name;
    `);

    const expectedColumns = ['source_email_id', 'source_metadata', 'source_type'];
    const actualColumns = result.rows.map(row => row.column_name);
    const allColumnsExist = expectedColumns.every(col => actualColumns.includes(col));

    if (allColumnsExist) {
      console.log('✓ Inquiries table has email source columns');
      return true;
    } else {
      const missingColumns = expectedColumns.filter(col => !actualColumns.includes(col));
      console.log('✗ Missing columns in inquiries:', missingColumns);
      return false;
    }
  } catch (error) {
    console.error('Error verifying inquiries columns:', error);
    return false;
  }
}

/**
 * Verify default platform patterns were seeded
 */
export async function verifyPlatformPatterns(pool: Pool): Promise<boolean> {
  try {
    const result = await pool.query(`
      SELECT platform_type, sender_pattern, is_active 
      FROM platform_patterns
      WHERE platform_type IN ('facebook', 'zillow', 'craigslist', 'turbotenant')
      ORDER BY platform_type;
    `);

    const expectedPlatforms = ['craigslist', 'facebook', 'turbotenant', 'zillow'];
    const actualPlatforms = result.rows.map(row => row.platform_type);
    const allPatternsExist = expectedPlatforms.every(platform => actualPlatforms.includes(platform));

    if (allPatternsExist) {
      console.log('✓ Default platform patterns seeded');
      console.log(`  Found ${result.rows.length} platform patterns`);
      return true;
    } else {
      const missingPlatforms = expectedPlatforms.filter(platform => !actualPlatforms.includes(platform));
      console.log('✗ Missing platform patterns:', missingPlatforms);
      return false;
    }
  } catch (error) {
    console.error('Error verifying platform patterns:', error);
    return false;
  }
}

/**
 * Run all verifications
 */
export async function verifyEmailIntegrationMigrations(pool: Pool): Promise<boolean> {
  console.log('\nVerifying email integration migrations...\n');

  const tablesExist = await verifyEmailIntegrationTables(pool);
  const columnsExist = await verifyInquiriesColumns(pool);
  const patternsExist = await verifyPlatformPatterns(pool);

  const allVerified = tablesExist && columnsExist && patternsExist;

  if (allVerified) {
    console.log('\n✓ All email integration migrations verified successfully');
  } else {
    console.log('\n✗ Some verifications failed');
  }

  return allVerified;
}

// CLI usage
if (require.main === module) {
  const { pool } = require('../connection');

  const command = process.argv[2];

  (async () => {
    try {
      switch (command) {
        case 'run':
          await runEmailIntegrationMigrations(pool);
          break;
        case 'verify':
          await verifyEmailIntegrationMigrations(pool);
          break;
        case 'run-and-verify':
          await runEmailIntegrationMigrations(pool);
          await verifyEmailIntegrationMigrations(pool);
          break;
        default:
          console.log('Usage:');
          console.log('  npm run migrate:email run           - Run all migrations');
          console.log('  npm run migrate:email verify        - Verify migrations');
          console.log('  npm run migrate:email run-and-verify - Run and verify');
      }
      await pool.end();
      process.exit(0);
    } catch (error) {
      console.error('Migration failed:', error);
      await pool.end();
      process.exit(1);
    }
  })();
}
