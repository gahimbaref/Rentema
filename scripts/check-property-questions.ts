import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function checkPropertyQuestions() {
  const pool = new Pool({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME || 'rentema',
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD
  });
  
  try {
    console.log('\n=== Checking Property Questions ===\n');
    
    // Get the property
    const propResult = await pool.query(`
      SELECT id, address, manager_id
      FROM properties
      WHERE address = '123 new street'
    `);
    
    if (propResult.rows.length === 0) {
      console.log('Property "123 new street" not found');
      return;
    }
    
    const property = propResult.rows[0];
    console.log(`Property: ${property.address}`);
    console.log(`Property ID: ${property.id}`);
    console.log(`Manager ID: ${property.manager_id}\n`);
    
    // Get questions for this property
    const questionsResult = await pool.query(`
      SELECT id, text, response_type, order_index, options
      FROM questions
      WHERE property_id = $1
      ORDER BY order_index ASC
    `, [property.id]);
    
    console.log(`Found ${questionsResult.rows.length} questions:\n`);
    
    if (questionsResult.rows.length === 0) {
      console.log('⚠️  No questions configured for this property!');
      console.log('This is why inquiries are being automatically qualified.\n');
      console.log('To fix this, you need to:');
      console.log('1. Go to the Properties page in the UI');
      console.log('2. Click on "123 new street"');
      console.log('3. Go to the "Pre-Qualification" tab');
      console.log('4. Add questions for prospective tenants');
    } else {
      for (const question of questionsResult.rows) {
        console.log(`Question ${question.order_index}: ${question.text}`);
        console.log(`  Type: ${question.response_type}`);
        console.log(`  Options: ${question.options ? JSON.stringify(question.options) : 'N/A'}`);
        console.log('');
      }
    }
    
    // Check qualification criteria
    console.log('\n=== Checking Qualification Criteria ===\n');
    
    const criteriaResult = await pool.query(`
      SELECT id, field, operator, value, weight
      FROM qualification_criteria
      WHERE property_id = $1
      ORDER BY weight DESC
    `, [property.id]);
    
    console.log(`Found ${criteriaResult.rows.length} criteria:\n`);
    
    if (criteriaResult.rows.length === 0) {
      console.log('⚠️  No qualification criteria configured!');
    } else {
      for (const criteria of criteriaResult.rows) {
        console.log(`Criteria: ${criteria.field} ${criteria.operator} ${criteria.value}`);
        console.log(`  Weight: ${criteria.weight}`);
        console.log('');
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkPropertyQuestions();
