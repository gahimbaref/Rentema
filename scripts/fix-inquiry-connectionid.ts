import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
});

async function fixConnectionId() {
  try {
    console.log('\n=== Fixing Inquiry Connection IDs ===\n');

    // Get the active connection ID
    const connectionResult = await pool.query(`
      SELECT id FROM email_connections WHERE is_active = true LIMIT 1
    `);

    if (connectionResult.rows.length === 0) {
      console.log('❌ No active email connection found');
      return;
    }

    const connectionId = connectionResult.rows[0].id;
    console.log(`Connection ID: ${connectionId}\n`);

    // Update all email inquiries that don't have a connectionId
    const result = await pool.query(`
      UPDATE inquiries
      SET source_metadata = jsonb_set(
        COALESCE(source_metadata, '{}'::jsonb),
        '{connectionId}',
        to_jsonb($1::text)
      )
      WHERE source_type = 'email'
        AND (source_metadata->>'connectionId') IS NULL
      RETURNING id
    `, [connectionId]);

    console.log(`✅ Updated ${result.rowCount || 0} inquiries with connectionId\n`);

    if (result.rowCount && result.rowCount > 0) {
      console.log('Updated inquiry IDs:');
      result.rows.forEach(row => console.log(`  - ${row.id}`));
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

fixConnectionId();
