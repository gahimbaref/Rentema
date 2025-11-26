import { Pool } from 'pg';
import dotenv from 'dotenv';
import { SchedulingLinkGenerator } from '../src/engines/SchedulingLinkGenerator';

dotenv.config();

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
});

async function testBookingConfirmation() {
  try {
    console.log('\n=== Testing Booking Confirmation ===\n');

    // Get a recent booking token
    const tokenResult = await pool.query(`
      SELECT token, inquiry_id, slot_start_time, appointment_type, is_used
      FROM booking_tokens
      WHERE is_used = false
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (tokenResult.rows.length === 0) {
      console.log('❌ No unused booking tokens found');
      console.log('   Run the questionnaire submission test first to generate tokens');
      return;
    }

    const tokenData = tokenResult.rows[0];
    console.log('Found booking token:');
    console.log(`  Token: ${tokenData.token}`);
    console.log(`  Inquiry: ${tokenData.inquiry_id}`);
    console.log(`  Time: ${tokenData.slot_start_time}`);
    console.log(`  Type: ${tokenData.appointment_type}`);
    console.log();

    // Book the appointment
    const generator = new SchedulingLinkGenerator(pool);
    
    console.log('Booking appointment...\n');
    const appointmentId = await generator.bookAppointment(tokenData.token);
    
    console.log('✅ Appointment booked successfully!');
    console.log(`   Appointment ID: ${appointmentId}`);
    console.log('📧 Check your email for the confirmation');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

testBookingConfirmation();
