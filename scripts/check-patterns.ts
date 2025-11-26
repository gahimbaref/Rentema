import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function checkPatterns() {
  const pool = new Pool({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
  });

  try {
    const result = await pool.query(`
      SELECT COUNT(*) as count, platform_type, priority
      FROM platform_patterns
      GROUP BY platform_type, priority
      ORDER BY priority DESC, platform_type
    `);

    console.log('Platform pattern counts:');
    result.rows.forEach(row => {
      console.log(`  ${row.platform_type} (priority ${row.priority}): ${row.count} patterns`);
    });

    // Check for direct pattern
    const directResult = await pool.query(`
      SELECT * FROM platform_patterns
      WHERE platform_type = 'direct'
      LIMIT 1
    `);

    console.log('\nDirect pattern exists:', directResult.rows.length > 0);
    if (directResult.rows.length > 0) {
      console.log('Direct pattern:', directResult.rows[0]);
    }

  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkPatterns();
