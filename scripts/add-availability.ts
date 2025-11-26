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

async function addAvailability() {
  try {
    console.log('\n=== Adding Availability Schedule ===\n');

    // Get the manager
    const managerResult = await pool.query(`
      SELECT id, name, email FROM property_managers LIMIT 1
    `);

    if (managerResult.rows.length === 0) {
      console.log('❌ No manager found');
      return;
    }

    const manager = managerResult.rows[0];
    console.log(`Manager: ${manager.name} (${manager.email})\n`);

    // Check if availability already exists
    const existingSchedule = await pool.query(`
      SELECT id FROM availability_schedules 
      WHERE manager_id = $1 AND schedule_type = 'tour'
    `, [manager.id]);

    if (existingSchedule.rows.length > 0) {
      console.log('⚠️  Availability schedule already exists');
      console.log('Updating existing schedule...\n');
      
      // Update existing schedule
      await pool.query(`
        UPDATE availability_schedules
        SET recurring_weekly = $1
        WHERE manager_id = $2 AND schedule_type = 'tour'
      `, [
        JSON.stringify({
          monday: [{ startTime: '09:00', endTime: '17:00' }],
          tuesday: [{ startTime: '09:00', endTime: '17:00' }],
          wednesday: [{ startTime: '09:00', endTime: '17:00' }],
          thursday: [{ startTime: '09:00', endTime: '17:00' }],
          friday: [{ startTime: '09:00', endTime: '17:00' }],
          saturday: [{ startTime: '10:00', endTime: '14:00' }],
          sunday: []
        }),
        manager.id
      ]);
      
      console.log('✅ Updated availability schedule');
    } else {
      // Create new schedule
      await pool.query(`
        INSERT INTO availability_schedules (manager_id, schedule_type, recurring_weekly, blocked_dates)
        VALUES ($1, $2, $3, $4)
      `, [
        manager.id,
        'tour',
        JSON.stringify({
          monday: [{ startTime: '09:00', endTime: '17:00' }],
          tuesday: [{ startTime: '09:00', endTime: '17:00' }],
          wednesday: [{ startTime: '09:00', endTime: '17:00' }],
          thursday: [{ startTime: '09:00', endTime: '17:00' }],
          friday: [{ startTime: '09:00', endTime: '17:00' }],
          saturday: [{ startTime: '10:00', endTime: '14:00' }],
          sunday: []
        }),
        JSON.stringify([])
      ]);

      console.log('✅ Created availability schedule');
    }

    console.log('\n=== Schedule Details ===');
    console.log('Monday-Friday: 9:00 AM - 5:00 PM');
    console.log('Saturday: 10:00 AM - 2:00 PM');
    console.log('Sunday: Closed');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

addAvailability();
