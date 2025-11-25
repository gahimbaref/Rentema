import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ValidationError } from '../middleware/errorHandler';
import { PropertyRepository } from '../../database/repositories/PropertyRepository';
import { InquiryRepository } from '../../database/repositories/InquiryRepository';
import { PlatformConnectionRepository } from '../../database/repositories/PlatformConnectionRepository';
import { WorkflowOrchestrator } from '../../engines/WorkflowOrchestrator';
import { getDatabasePool } from '../../database/connection';
import { InquiryStatus } from '../../models';

const router = Router();

// POST /test/properties - Create test property
router.post('/properties', async (req: AuthRequest, res: Response, next) => {
  try {
    const { address, rentAmount, bedrooms, bathrooms, availabilityDate } = req.body;

    // Validation
    if (!address || typeof address !== 'string') {
      throw new ValidationError('Address is required and must be a string');
    }

    const pool = getDatabasePool();
    const propertyRepo = new PropertyRepository(pool);

    // Create test property
    const property = await propertyRepo.create({
      managerId: req.managerId!,
      address,
      rentAmount: rentAmount || 1000,
      bedrooms: bedrooms || 2,
      bathrooms: bathrooms || 1,
      availabilityDate: availabilityDate ? new Date(availabilityDate) : new Date(),
      isTestMode: true, // Mark as test mode
      isArchived: false,
    });

    res.status(201).json({
      message: 'Test property created successfully',
      property,
      testMode: true,
    });
  } catch (error) {
    next(error);
  }
});

// POST /test/inquiries - Simulate inquiry
router.post('/inquiries', async (req: AuthRequest, res: Response, next) => {
  try {
    const { propertyId, prospectiveTenantName } = req.body;

    // Validation
    if (!propertyId || typeof propertyId !== 'string') {
      throw new ValidationError('Property ID is required');
    }

    const pool = getDatabasePool();
    const propertyRepo = new PropertyRepository(pool);
    const inquiryRepo = new InquiryRepository(pool);
    const platformRepo = new PlatformConnectionRepository(pool);

    // Verify property exists and is owned by this manager
    const property = await propertyRepo.findById(propertyId);
    if (!property) {
      throw new ValidationError('Property not found');
    }
    if (property.managerId !== req.managerId) {
      throw new ValidationError('Property not found');
    }

    // Ensure property is in test mode
    if (!property.isTestMode) {
      throw new ValidationError('Property must be in test mode to simulate inquiries');
    }

    // Get or create test platform connection
    let testPlatform = (await platformRepo.findByManagerId(req.managerId!))
      .find(p => p.platformType === 'test');

    if (!testPlatform) {
      testPlatform = await platformRepo.create({
        managerId: req.managerId!,
        platformType: 'test',
        credentials: { platformType: 'test' },
        isActive: true,
        lastVerified: new Date(),
      });
    }

    // Create simulated inquiry
    const inquiry = await inquiryRepo.create({
      propertyId,
      platformId: testPlatform.id,
      externalInquiryId: `test-${Date.now()}-${Math.random()}`,
      prospectiveTenantId: `test-tenant-${Date.now()}`,
      prospectiveTenantName: prospectiveTenantName || 'Test Tenant',
      status: 'new' as InquiryStatus,
      qualificationResult: undefined,
      questionSnapshot: undefined,
    });

    // Process the inquiry through the workflow
    const orchestrator = new WorkflowOrchestrator(pool);
    await orchestrator.processNewInquiry(inquiry);

    // Get updated inquiry
    const updatedInquiry = await inquiryRepo.findById(inquiry.id);

    res.status(201).json({
      message: 'Test inquiry simulated successfully',
      inquiry: updatedInquiry,
      testMode: true,
      note: 'This inquiry was created in test mode and will execute the complete automated workflow',
    });
  } catch (error) {
    next(error);
  }
});

export default router;


// POST /test/migrate-body-column - Add body column to processed_emails (temporary migration endpoint)
router.post('/migrate-body-column', async (req: AuthRequest, res: Response, next) => {
  try {
    const pool = getDatabasePool();
    
    await pool.query(`
      ALTER TABLE processed_emails 
      ADD COLUMN IF NOT EXISTS body TEXT;
    `);

    res.json({
      message: 'Body column added successfully to processed_emails table',
      success: true
    });
  } catch (error) {
    next(error);
  }
});
