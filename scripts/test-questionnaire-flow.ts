import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { EmailWorkflowOrchestrator } from '../src/engines/EmailWorkflowOrchestrator';
import { InquiryRepository } from '../src/database/repositories/InquiryRepository';

dotenv.config();

async function testQuestionnaireFlow() {
  const pool = new Pool({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
  });

  try {
    const inquiryRepo = new InquiryRepository(pool);
    const orchestrator = new EmailWorkflowOrchestrator(pool);

    // Get the most recent inquiry
    const result = await pool.query(`
      SELECT id, status, property_id, prospective_tenant_name
      FROM inquiries
      WHERE status = 'questionnaire_completed'
      ORDER BY updated_at DESC
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      console.log('No inquiries with questionnaire_completed status found');
      return;
    }

    const inquiry = result.rows[0];
    console.log('Testing questionnaire flow for inquiry:', {
      id: inquiry.id,
      status: inquiry.status,
      propertyId: inquiry.property_id,
      tenantName: inquiry.prospective_tenant_name,
    });

    // Check if there are responses
    const responsesResult = await pool.query(
      'SELECT * FROM responses WHERE inquiry_id = $1',
      [inquiry.id]
    );
    console.log(`Found ${responsesResult.rows.length} responses`);

    // Check if there are qualification criteria
    const criteriaResult = await pool.query(
      'SELECT * FROM qualification_criteria WHERE property_id = $1',
      [inquiry.property_id]
    );
    console.log(`Found ${criteriaResult.rows.length} qualification criteria`);

    // Trigger the workflow
    console.log('\nTriggering handleQuestionnaireSubmission...');
    await orchestrator.handleQuestionnaireSubmission(inquiry.id);

    // Check the updated status
    const updatedInquiry = await inquiryRepo.findById(inquiry.id);
    console.log('\nUpdated inquiry status:', updatedInquiry?.status);
    console.log('Qualification result:', updatedInquiry?.qualificationResult);

  } catch (error: any) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

testQuestionnaireFlow();
