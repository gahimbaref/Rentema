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

async function debugInquiryScheduling() {
  try {
    const inquiryId = 'f66aa5c5-2c5a-4a4e-9ff3-2f90873e6ba7';
    
    console.log('\n=== Debugging Inquiry Scheduling ===\n');
    console.log(`Inquiry ID: ${inquiryId}\n`);

    // Get inquiry details
    const inquiryResult = await pool.query(`
      SELECT i.*, p.manager_id, p.address as property_address
      FROM inquiries i
      LEFT JOIN properties p ON i.property_id = p.id
      WHERE i.id = $1
    `, [inquiryId]);

    if (inquiryResult.rows.length === 0) {
      console.log('❌ Inquiry not found!');
      return;
    }

    const inquiry = inquiryResult.rows[0];
    console.log('Inquiry Details:');
    console.log(`  Property: ${inquiry.property_address}`);
    console.log(`  Property ID: ${inquiry.property_id}`);
    console.log(`  Manager ID: ${inquiry.manager_id}`);
    console.log(`  Status: ${inquiry.status}`);

    if (!inquiry.manager_id) {
      console.log('\n❌ No manager assigned to this property!');
      console.log('   This is why scheduling is failing.');
      
      // Check if there are any managers
      const managersResult = await pool.query(`
        SELECT id, name, email FROM property_managers
      `);
      
      console.log('\n📋 Available Managers:');
      managersResult.rows.forEach(m => {
        console.log(`  - ${m.name} (${m.id})`);
      });
      
      if (managersResult.rows.length > 0) {
        console.log('\n💡 Solution: Assign a manager to the property');
        console.log(`   UPDATE properties SET manager_id = '${managersResult.rows[0].id}' WHERE id = '${inquiry.property_id}';`);
      }
      return;
    }

    // Check availability schedules for this manager
    const schedulesResult = await pool.query(`
      SELECT * FROM availability_schedules
      WHERE manager_id = $1 AND schedule_type = 'tour'
    `, [inquiry.manager_id]);

    console.log('\n📅 Availability Schedules:');
    if (schedulesResult.rows.length === 0) {
      console.log('  ❌ No schedules found for this manager!');
    } else {
      schedulesResult.rows.forEach(s => {
        console.log(`  Schedule Type: ${s.schedule_type}`);
        console.log(`  Weekly: ${JSON.stringify(s.recurring_weekly, null, 2)}`);
      });
    }

    // Test the SchedulingLinkGenerator
    console.log('\n=== Testing SchedulingLinkGenerator ===\n');
    
    const { SchedulingLinkGenerator } = await import('../src/engines/SchedulingLinkGenerator');
    const generator = new SchedulingLinkGenerator(pool);
    
    try {
      const result = await generator.generateSchedulingLinks(inquiryId, {
        appointmentType: 'tour',
        daysAhead: 7,
        minSlotsToShow: 3
      });
      
      console.log(`✅ Generated ${result.slots.length} links`);
      result.slots.slice(0, 3).forEach((slot, i) => {
        const time = slot.startTime.toLocaleString();
        console.log(`  ${i + 1}. ${time}`);
      });
    } catch (error: any) {
      console.log(`❌ Error: ${error.message}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

debugInquiryScheduling();
