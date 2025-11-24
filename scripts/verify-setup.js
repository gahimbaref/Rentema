/**
 * Verify Rentema setup - checks all prerequisites
 */

const { Pool } = require('pg');
const { createClient } = require('redis');
require('dotenv').config();

async function verifyPostgreSQL() {
  console.log('\n🔍 Checking PostgreSQL...');
  
  try {
    const pool = new Pool({
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      database: process.env.DATABASE_NAME || 'rentema',
      user: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres',
    });

    const result = await pool.query('SELECT version()');
    console.log('✅ PostgreSQL connected');
    console.log('   Version:', result.rows[0].version.split(',')[0]);

    // Check if tables exist
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    if (tables.rows.length > 0) {
      console.log(`✅ Database schema loaded (${tables.rows.length} tables)`);
      console.log('   Tables:', tables.rows.map(r => r.table_name).join(', '));
    } else {
      console.log('⚠️  No tables found. Run: psql -U postgres -d rentema -f database/schema.sql');
    }

    await pool.end();
  } catch (error) {
    console.log('❌ PostgreSQL connection failed');
    console.log('   Error:', error.message);
    console.log('   Fix: Check your .env file and ensure PostgreSQL is running');
    return false;
  }

  return true;
}

async function verifyRedis() {
  console.log('\n🔍 Checking Redis...');
  
  try {
    const client = createClient({
      socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      }
    });

    client.on('error', () => {}); // Suppress error logs

    await client.connect();
    const pong = await client.ping();
    
    if (pong === 'PONG') {
      console.log('✅ Redis connected');
      const info = await client.info('server');
      const version = info.match(/redis_version:([^\r\n]+)/)?.[1];
      if (version) {
        console.log('   Version:', version);
      }
    }

    await client.quit();
  } catch (error) {
    console.log('❌ Redis connection failed');
    console.log('   Error:', error.message);
    console.log('   Fix: Ensure Redis/Memurai is installed and running');
    return false;
  }

  return true;
}

async function verifyEnvironment() {
  console.log('\n🔍 Checking Environment...');
  
  const required = [
    'DATABASE_HOST',
    'DATABASE_PORT',
    'DATABASE_NAME',
    'DATABASE_USER',
    'DATABASE_PASSWORD',
    'REDIS_HOST',
    'REDIS_PORT'
  ];

  let allPresent = true;
  for (const key of required) {
    if (process.env[key]) {
      console.log(`✅ ${key} is set`);
    } else {
      console.log(`⚠️  ${key} is not set (using default)`);
      allPresent = false;
    }
  }

  if (!allPresent) {
    console.log('\n💡 Tip: Copy .env.example to .env and configure your settings');
  }

  return true;
}

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('   Rentema Setup Verification');
  console.log('═══════════════════════════════════════');

  const envOk = await verifyEnvironment();
  const pgOk = await verifyPostgreSQL();
  const redisOk = await verifyRedis();

  console.log('\n═══════════════════════════════════════');
  if (envOk && pgOk && redisOk) {
    console.log('✅ All systems ready!');
    console.log('\nYou can now start development:');
    console.log('  npm run dev');
  } else {
    console.log('⚠️  Some issues need attention');
    console.log('\nSetup guides:');
    console.log('  PostgreSQL: See POSTGRESQL_SETUP.md');
    console.log('  Redis: See REDIS_SETUP.md');
  }
  console.log('═══════════════════════════════════════\n');
}

main().catch(console.error);
