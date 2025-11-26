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

async function addQualificationCriteria() {
  try {
    console.log('\n=== Adding Qualification Criteria ===\n');

    // Get the property
    const propertyResult = await pool.query(`
      SELECT id, address FROM properties WHERE address LIKE '%123 new street%' LIMIT 1
    `);

    if (propertyResult.rows.length === 0) {
      console.log('❌ Property not found');
      return;
    }

    const property = propertyResult.rows[0];
    console.log(`Property: ${property.address} (${property.id})\n`);

    // Get questions
    const questionsResult = await pool.query(`
      SELECT id, text, response_type FROM questions WHERE property_id = $1 ORDER BY order_index
    `, [property.id]);

    if (questionsResult.rows.length === 0) {
      console.log('❌ No questions found for property');
      return;
    }

    console.log('Questions:');
    questionsResult.rows.forEach((q, i) => {
      console.log(`  ${i + 1}. ${q.text} (${q.response_type})`);
    });

    // Add criteria for household income (assuming first question is income)
    const incomeQuestion = questionsResult.rows.find(q => 
      q.text.toLowerCase().includes('income')
    );

    if (incomeQuestion) {
      // Check if criteria already exists
      const existingCriteria = await pool.query(`
        SELECT id FROM qualification_criteria 
        WHERE property_id = $1 AND question_id = $2
      `, [property.id, incomeQuestion.id]);

      if (existingCriteria.rows.length === 0) {
        await pool.query(`
          INSERT INTO qualification_criteria (property_id, question_id, operator, expected_value)
          VALUES ($1, $2, $3, $4)
        `, [property.id, incomeQuestion.id, 'greater_than', '3000']);

        console.log(`\n✅ Added criteria: Income must be greater than $3000`);
      } else {
        console.log(`\n⚠️  Criteria already exists for income question`);
      }
    }

    console.log('\n=== Summary ===');
    const criteriaResult = await pool.query(`
      SELECT qc.*, q.text as question_text
      FROM qualification_criteria qc
      JOIN questions q ON qc.question_id = q.id
      WHERE qc.property_id = $1
    `, [property.id]);

    console.log(`Total criteria: ${criteriaResult.rows.length}`);
    criteriaResult.rows.forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.question_text}: ${c.operator} ${c.expected_value}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

addQualificationCriteria();
