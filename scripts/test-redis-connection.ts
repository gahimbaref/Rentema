/**
 * Simple script to test Redis connection
 * Run with: npx ts-node scripts/test-redis-connection.ts
 */

import dotenv from 'dotenv';
import { createRedisClient, closeRedisClient } from '../src/database/connection';

dotenv.config();

async function testConnection() {
  console.log('Testing Redis connection...');
  console.log('Host:', process.env.REDIS_HOST || 'localhost');
  console.log('Port:', process.env.REDIS_PORT || '6379');
  console.log('');

  try {
    const client = await createRedisClient();
    
    // Test ping
    const pong = await client.ping();
    console.log('✅ Connection successful!');
    console.log('Ping response:', pong);
    console.log('');

    // Test set/get
    await client.set('test:rentema', 'Hello from Rentema!');
    const value = await client.get('test:rentema');
    console.log('✅ Set/Get test passed!');
    console.log('Value:', value);
    console.log('');

    // Clean up test key
    await client.del('test:rentema');

    await closeRedisClient();
    console.log('✅ Redis is ready for use!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection failed:', error);
    console.error('');
    console.error('Troubleshooting:');
    console.error('1. Make sure Redis is installed and running');
    console.error('2. Check your .env file has correct Redis settings');
    console.error('3. Test Redis: redis-cli ping (should return PONG)');
    console.error('4. See REDIS_SETUP.md for installation instructions');
    process.exit(1);
  }
}

testConnection();
