import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { SchedulingLinkGenerator } from '../src/engines/SchedulingLinkGenerator';

dotenv.config();

async function testBookingConfirmation() {
  const pool = new Pool({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
  });

  try {
    const schedulingLinkGen = new SchedulingLinkGenerator(pool);

    // Get the most recent unused booking token
    const result = await pool.query(`
      SELECT token, inquiry_id, slot_start_time, slot_end_time, appointment_type
      FROM booking_tokens
      WHERE is_used = false
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      console.log('No unused booking tokens found');
      console.log('\nTo test this, you need to:');
      console.log('1. Have a qualified inquiry');
      console.log('2. Run the questionnaire flow to generate booking links');
      return;
    }

    const token = result.rows[0];
    console.log('Testing booking confirmation for token:', {
      token: token.token,
      inquiryId: token.inquiry_id,
      slotTime: token.slot_start_time,
      appointmentType: token.appointment_type,
    });

    // Validate the booking link
    console.log('\nValidating booking link...');
    const validation = await schedulingLinkGen.validateBookingLink(token.token);
    console.log('Validation result:', validation);

    if (!validation.isValid) {
      console.log('Token is not valid, cannot proceed');
      return;
    }

    // Check email connections
    const connections = await pool.query('SELECT id, email_address FROM email_connections');
    console.log('\nAvailable email connections:', connections.rows);

    // Book the appointment
    console.log('\nBooking appointment...');
    const appointmentId = await schedulingLinkGen.bookAppointment(token.token);
    console.log('Appointment booked successfully!');
    console.log('Appointment ID:', appointmentId);

    // Check the inquiry status
    const inquiryResult = await pool.query(
      'SELECT id, status FROM inquiries WHERE id = $1',
      [token.inquiry_id]
    );
    console.log('\nInquiry status:', inquiryResult.rows[0]);

    // Check if email was sent
    const emailResult = await pool.query(
      'SELECT * FROM sent_email_logs WHERE inquiry_id = $1 ORDER BY sent_at DESC LIMIT 1',
      [token.inquiry_id]
    );
    console.log('\nMost recent email sent:', emailResult.rows[0] ? {
      subject: emailResult.rows[0].subject,
      to: emailResult.rows[0].to_email,
      sentAt: emailResult.rows[0].sent_at,
      status: emailResult.rows[0].status,
    } : 'No email found');

  } catch (error: any) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

testBookingConfirmation();
