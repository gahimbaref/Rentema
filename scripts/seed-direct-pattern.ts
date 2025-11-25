import { getDatabasePool } from '../src/database/connection';
import { seedPlatformPatterns } from '../src/database/seeds/platformPatterns';

async function main() {
  console.log('Seeding direct inquiry platform pattern...');
  
  const pool = getDatabasePool();
  
  try {
    await seedPlatformPatterns(pool);
    console.log('✓ Direct inquiry pattern seeded successfully');
  } catch (error) {
    console.error('Error seeding pattern:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
