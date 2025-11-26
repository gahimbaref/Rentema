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

async function checkToken() {
  try {
    const token = '47757bea-2334-48f3-9cc4-917b8e4e2dc8';
    
    // Check token
    const tokenResult = await pool.query(
      'SELECT * FROM questionnaire_tokens WHERE token = $1',
      [token]
    );
    
    console.log('\n=== Token Info ===');
    console.log(JSON.stringify(tokenResult.rows[0], null, 2));
    
    if (tokenResult.rows[0]) {
      const inquiryId = tokenResult.rows[0].inquiry_id;
      
      // Check inquiry
      const inquiryResult = await pool.query(
        'SELECT * FROM inquiries WHERE id = $1',
        [inquiryId]
      );
      
      console.log('\n=== Inquiry Info ===');
      console.log(JSON.stringify(inquiryResult.rows[0], null, 2));
      
      if (inquiryResult.rows[0]?.property_id) {
        // Check questions
        const questionsResult = await pool.query(
          'SELECT * FROM questions WHERE property_id = $1 ORDER BY order_index',
          [inquiryResult.rows[0].property_id]
        );
        
        console.log('\n=== Questions ===');
        console.log(`Found ${questionsResult.rows.length} questions`);
        questionsResult.rows.forEach((q, i) => {
          console.log(`${i + 1}. ${q.text} (${q.response_type})`);
        });
      }
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkToken();
