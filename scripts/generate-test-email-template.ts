import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function generateTestEmailTemplate() {
  const pool = new Pool({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
  });

  try {
    // Get email connection
    const connectionResult = await pool.query(`
      SELECT email_address
      FROM email_connections
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (connectionResult.rows.length === 0) {
      console.error('No email connection found.');
      return;
    }

    const emailAddress = connectionResult.rows[0].email_address;

    // Get active properties
    const propertiesResult = await pool.query(`
      SELECT address
      FROM properties
      WHERE is_archived = false
      ORDER BY created_at DESC
    `);

    if (propertiesResult.rows.length === 0) {
      console.error('No active properties found.');
      return;
    }

    console.log('=== TEST EMAIL TEMPLATE ===\n');
    console.log('Send this email to:', emailAddress);
    console.log('(You can send it from any email address)\n');
    console.log('Available properties:');
    propertiesResult.rows.forEach((prop, index) => {
      console.log(`  ${index + 1}. ${prop.address}`);
    });
    console.log('\n--- EMAIL TEMPLATE (copy everything below) ---\n');

    const propertyAddress = propertiesResult.rows[0].address;

    console.log(`To: ${emailAddress}`);
    console.log(`Subject: Rental Inquiry for ${propertyAddress}`);
    console.log('');
    console.log('Body:');
    console.log('---');
    console.log(`Hi,

I'm very interested in renting the property at ${propertyAddress}.

My name is Jane Smith
Email: jane.smith@example.com
Phone: (555) 987-6543

I'm looking for a place to move in next month. Could you please provide more information about:
- Availability date
- Monthly rent
- Lease terms
- Pet policy

I'm happy to schedule a viewing at your earliest convenience.

Thank you for your time!

Best regards,
Jane Smith`);
    console.log('---\n');

    console.log('After sending, the email should be picked up within 1 minute.');
    console.log('Check the inquiries page or run: npx ts-node scripts/debug-email-polling.ts');

  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

generateTestEmailTemplate();
