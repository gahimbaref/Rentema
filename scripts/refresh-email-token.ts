/**
 * Refresh OAuth token for email connection
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { OAuthManager } from '../src/engines/OAuthManager';

dotenv.config();

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
});

async function refreshToken() {
  try {
    console.log('\n=== Refreshing Email OAuth Token ===\n');

    // Get active connection
    const connectionResult = await pool.query(`
      SELECT id, email_address
      FROM email_connections
      WHERE is_active = true
      LIMIT 1
    `);

    if (connectionResult.rows.length === 0) {
      console.log('❌ No active email connection found');
      return;
    }

    const connection = connectionResult.rows[0];
    console.log(`Connection: ${connection.email_address}`);
    console.log(`ID: ${connection.id}\n`);

    // Refresh token
    const oauthManager = new OAuthManager();
    console.log('Refreshing token...\n');
    
    await oauthManager.refreshAccessToken(connection.id);

    console.log('✅ Token refreshed successfully!\n');
    console.log('You can now send emails using this connection.');
    console.log('');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.log('');
    console.log('If the refresh token is invalid, you need to:');
    console.log('1. Disconnect the email connection in the UI');
    console.log('2. Reconnect Gmail to get new tokens');
    console.log('');
  } finally {
    await pool.end();
  }
}

refreshToken();
