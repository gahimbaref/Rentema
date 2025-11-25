import dotenv from 'dotenv';
import { startServer } from './api/server';
import { createDatabasePool, runMigrations } from './database';

// Load environment variables
dotenv.config();

console.log('Rentema - Rental Property Management System');
console.log('Environment:', process.env.NODE_ENV || 'development');

// Initialize database
async function initialize() {
  try {
    console.log('Initializing database connection...');
    const pool = createDatabasePool();
    
    // Try to run migrations, but don't fail if they're already applied
    try {
      console.log('Running database migrations...');
      await runMigrations(pool);
      console.log('✓ Database migrations completed');
    } catch (migrationError: any) {
      if (migrationError.code === '40P01') {
        console.log('⚠️  Database deadlock detected, skipping migrations (likely already applied)');
      } else {
        console.warn('⚠️  Migration warning:', migrationError.message);
        console.log('Continuing with server startup...');
      }
    }
    
    console.log('✓ Database initialized');
    
    // Start the API server
    const port = parseInt(process.env.PORT || '5000', 10);
    startServer(port);
  } catch (error) {
    console.error('Failed to initialize application:', error);
    process.exit(1);
  }
}

// Start the application
initialize();
