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

async function addVideoCallAvailability() {
  try {
    console.log('\n=== Adding Video Call Availability ===\n');

    const managerId = '00000000-0000-0000-0000-000000000001';

    // Check if video_call schedule already exists
    const existing = await pool.query(
      'SELECT * FROM availability_schedules WHERE manager_id = $1 AND schedule_type = $2',
      [managerId, 'video_call']
    );

    if (existing.rows.length > 0) {
      console.log('✅ Video call availability already exists');
      console.log(JSON.stringify(existing.rows[0].recurring_weekly, null, 2));
      return;
    }

    // Create video call availability (same as tour schedule)
    const schedule = {
      monday: [{ startTime: '09:00', endTime: '17:00' }],
      tuesday: [{ startTime: '09:00', endTime: '17:00' }],
      wednesday: [{ startTime: '09:00', endTime: '17:00' }],
      thursday: [{ startTime: '09:00', endTime: '17:00' }],
      friday: [{ startTime: '09:00', endTime: '17:00' }],
      saturday: [{ startTime: '10:00', endTime: '14:00' }],
      sunday: [],
    };

    await pool.query(
      `INSERT INTO availability_schedules (manager_id, schedule_type, recurring_weekly, blocked_dates)
       VALUES ($1, $2, $3, $4)`,
      [managerId, 'video_call', JSON.stringify(schedule), JSON.stringify([])]
    );

    console.log('✅ Video call availability added successfully!');
    console.log('\nSchedule:');
    console.log(JSON.stringify(schedule, null, 2));

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

addVideoCallAvailability();
