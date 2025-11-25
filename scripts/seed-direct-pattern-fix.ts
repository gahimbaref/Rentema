import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function seedDirectPattern() {
  const pool = new Pool({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME || 'rentema',
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD
  });
  
  try {
    console.log('\n=== Seeding Direct Platform Pattern ===\n');
    
    // Insert the direct pattern
    const result = await pool.query(
      `INSERT INTO platform_patterns (platform_type, sender_pattern, subject_pattern, priority, is_active)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [
        'direct',
        '.*',
        'rent|rental|apartment|property|lease|interested|inquiry|available',
        10,
        true
      ]
    );
    
    if (result.rows.length > 0) {
      console.log('✓ Successfully seeded direct platform pattern');
      console.log(result.rows[0]);
    } else {
      console.log('Pattern already exists or conflict occurred');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

seedDirectPattern();
