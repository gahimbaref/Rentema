/**
 * Seed Platform Patterns Script
 * 
 * This script seeds the default platform patterns into the database.
 * It can be run independently to ensure patterns are up to date.
 * 
 * Usage: npx ts-node scripts/seed-platform-patterns.ts
 */

import { getPool } from '../src/database/connection';
import { seedPlatformPatterns } from '../src/database/seeds/platformPatterns';

async function main() {
  console.log('Starting platform pattern seeding...\n');
  
  const pool = getPool();
  
  try {
    await seedPlatformPatterns(pool);
    console.log('\n✓ Platform patterns seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Error seeding platform patterns:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
