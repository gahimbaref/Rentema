import * as dotenv from 'dotenv';
dotenv.config();

import { createDatabasePool } from '../src/database/connection';
import { EmailWorkflowOrchestrator } from '../src/engines/EmailWorkflowOrchestrator';
import { InquiryRepository } from '../src/database/repositories/InquiryRepository';

async function startWorkflow() {
  const pool = createDatabasePool();
  const orchestrator = new EmailWorkflowOrchestrator(pool);
  const inquiryRepo = new InquiryRepository(pool);

  try {
    // Get the inquiry ID from command line or use the latest
    const inquiryId = process.argv[2] || 'f66aa5c5-2c5a-4a4e-9ff3-2f90873e6ba7';

    console.log(`\n🚀 Starting email workflow for inquiry: ${inquiryId}\n`);

    // Get inquiry details
    const inquiry = await inquiryRepo.findById(inquiryId);
    
    if (!inquiry) {
      console.error('❌ Inquiry not found');
      process.exit(1);
    }

    console.log('📋 Inquiry Details:');
    console.log(`   Tenant: ${inquiry.tenantName}`);
    console.log(`   Email: ${inquiry.tenantEmail}`);
    console.log(`   Property: ${inquiry.propertyId}`);
    console.log(`   Status: ${inquiry.status}`);
    console.log(`   Source: ${inquiry.sourceType || 'platform_api'}\n`);

    // Get connection ID (you'll need to replace this with actual connection ID)
    const connectionId = process.env.EMAIL_CONNECTION_ID || inquiry.sourceMetadata?.connectionId;

    if (!connectionId) {
      console.error('❌ No email connection ID found');
      console.log('   Please set EMAIL_CONNECTION_ID in .env or ensure inquiry has connectionId in sourceMetadata');
      process.exit(1);
    }

    console.log(`📧 Using connection ID: ${connectionId}\n`);

    // Start the workflow
    await orchestrator.startEmailWorkflow(inquiryId, connectionId);

    console.log('✅ Email workflow started successfully!');
    console.log('   - Questionnaire token generated');
    console.log('   - Email sent to tenant');
    console.log('   - Inquiry status updated\n');

    // Get updated inquiry
    const updatedInquiry = await inquiryRepo.findById(inquiryId);
    console.log(`📊 New Status: ${updatedInquiry?.status}\n`);

  } catch (error: any) {
    console.error('❌ Error starting workflow:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

startWorkflow();
