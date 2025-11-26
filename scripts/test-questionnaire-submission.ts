import { Pool } from 'pg';
import dotenv from 'dotenv';
import { EmailWorkflowOrchestrator } from '../src/engines/EmailWorkflowOrchestrator';

dotenv.config();

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
});

async function testQuestionnaireSubmission() {
  try {
    const inquiryId = 'f66aa5c5-2c5a-4a4e-9ff3-2f90873e6ba7';
    
    console.log('\n=== Testing Questionnaire Submission ===\n');
    console.log(`Inquiry ID: ${inquiryId}\n`);

    const orchestrator = new EmailWorkflowOrchestrator(pool);
    
    console.log('Triggering questionnaire submission handler...\n');
    await orchestrator.handleQuestionnaireSubmission(inquiryId);
    
    console.log('\n✅ Questionnaire submission handled successfully!');
    console.log('📧 Check your email for the scheduling invite');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

testQuestionnaireSubmission();
