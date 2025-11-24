/**
 * Simple script to test database connection
 * Run with: npx ts-node scripts/test-db-connection.ts
 */

import dotenv from 'dotenv';
import { createDatabasePool, closeDatabasePool } from '../src/database/connection';

dotenv.config();

async function testConnection() {
  console.log('Testing PostgreSQL connection...');
  console.log('Host:', process.env.DATABASE_HOST || 'localhost');
  console.log('Port:', process.env.DATABASE_PORT || '5432');
  console.log('Database:', process.env.DATABASE_NAME || 'rentema');
  console.log('User:', process.env.DATABASE_USER || 'postgres');
  console.log('');

  try {
    const pool = createDatabasePool();
    
    // Test query
    const result = await pool.query('SELECT version()');
    console.log('✅ Connection successful!');
    console.log('PostgreSQL version:', result.rows[0].version);
    console.log('');

    // Test if tables exist
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    if (tablesResult.rows.length > 0) {
      console.log('✅ Schema loaded! Found tables:');
      tablesResult.rows.forEach(row => {
        console.log('  -', row.table_name);
      });
    } else {
      console.log('⚠️  No tables found. Run the schema:');
      console.log('   psql -U postgres -d rentema -f database/schema.sql');
    }

    await closeDatabasePool();
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection failed:', error);
    console.error('');
    console.error('Troubleshooting:');
    console.error('1. Make sure PostgreSQL is installed and running');
    console.error('2. Check your .env file has correct credentials');
    console.error('3. Verify the database exists: psql -U postgres -l');
    console.error('4. Create database if needed: psql -U postgres -c "CREATE DATABASE rentema;"');
    process.exit(1);
  }
}

testConnection();
