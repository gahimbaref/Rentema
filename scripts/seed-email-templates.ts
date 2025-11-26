import { Pool } from 'pg';
import dotenv from 'dotenv';
import { defaultEmailTemplates } from '../src/data/defaultEmailTemplates';

dotenv.config();

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
});

async function seedEmailTemplates() {
  try {
    console.log('\n=== Seeding Email Templates ===\n');

    // Get the first manager
    const managerResult = await pool.query(`
      SELECT id, name, email FROM property_managers LIMIT 1
    `);

    if (managerResult.rows.length === 0) {
      console.log('❌ No property managers found. Please create a manager first.');
      return;
    }

    const manager = managerResult.rows[0];
    console.log(`Using manager: ${manager.name} (${manager.email})\n`);

    // Insert default templates
    for (const template of defaultEmailTemplates) {
      // Check if template already exists
      const existingResult = await pool.query(`
        SELECT id FROM email_templates
        WHERE manager_id = $1 AND template_type = $2
      `, [manager.id, template.templateType]);

      if (existingResult.rows.length > 0) {
        console.log(`✓ Template '${template.templateType}' already exists, skipping`);
        continue;
      }

      // Insert template
      await pool.query(`
        INSERT INTO email_templates (
          manager_id,
          template_type,
          subject,
          html_body,
          plain_text_body,
          variables,
          is_default
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        manager.id,
        template.templateType,
        template.subject,
        template.htmlBody,
        template.plainTextBody,
        JSON.stringify(template.variables),
        true
      ]);

      console.log(`✓ Created template: ${template.templateType}`);
    }

    console.log('\n✅ Email templates seeded successfully!\n');

  } catch (error) {
    console.error('❌ Error seeding templates:', error);
  } finally {
    await pool.end();
  }
}

seedEmailTemplates();
