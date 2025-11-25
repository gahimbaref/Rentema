import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ValidationError, NotFoundError } from '../middleware/errorHandler';
import { WorkflowOrchestrator } from '../../engines/WorkflowOrchestrator';
import { InquiryRepository } from '../../database/repositories/InquiryRepository';
import { PropertyRepository } from '../../database/repositories/PropertyRepository';
import { MessageRepository } from '../../database/repositories/MessageRepository';
import { ResponseRepository } from '../../database/repositories/ResponseRepository';
import { InquiryNoteRepository } from '../../database/repositories/InquiryNoteRepository';
import { getPool } from '../../database/connection';

const router = Router();

// GET /inquiries - List inquiries with filtering
router.get('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const { propertyId, status, startDate, endDate } = req.query;

    const pool = getPool();
    const inquiryRepo = new InquiryRepository(pool);
    const propertyRepo = new PropertyRepository(pool);

    // Get all properties for this manager to verify ownership
    const properties = await propertyRepo.findByManagerId(req.managerId!);
    const propertyIds = new Set(properties.map(p => p.id));

    let inquiries;

    if (propertyId) {
      // Verify property ownership
      if (!propertyIds.has(propertyId as string)) {
        throw new NotFoundError('Property not found');
      }
      inquiries = await inquiryRepo.findByPropertyId(propertyId as string);
    } else {
      // Get all inquiries for all properties owned by this manager
      inquiries = [];
      for (const property of properties) {
        const propertyInquiries = await inquiryRepo.findByPropertyId(property.id);
        inquiries.push(...propertyInquiries);
      }
    }

    // Apply status filter
    if (status) {
      inquiries = inquiries.filter(i => i.status === status);
    }

    // Apply date range filter
    if (startDate) {
      const start = new Date(startDate as string);
      inquiries = inquiries.filter(i => new Date(i.createdAt) >= start);
    }
    if (endDate) {
      const end = new Date(endDate as string);
      inquiries = inquiries.filter(i => new Date(i.createdAt) <= end);
    }

    // Group by property
    const groupedInquiries = inquiries.reduce((acc, inquiry) => {
      if (!acc[inquiry.propertyId]) {
        acc[inquiry.propertyId] = [];
      }
      acc[inquiry.propertyId].push(inquiry);
      return acc;
    }, {} as Record<string, typeof inquiries>);

    res.json({
      inquiries,
      groupedByProperty: groupedInquiries,
      total: inquiries.length,
    });
  } catch (error) {
    next(error);
  }
});

// GET /inquiries/:id - Get inquiry details with history
router.get('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    const pool = getPool();
    const inquiryRepo = new InquiryRepository(pool);
    const propertyRepo = new PropertyRepository(pool);
    const messageRepo = new MessageRepository(pool);
    const responseRepo = new ResponseRepository(pool);
    const noteRepo = new InquiryNoteRepository(pool);

    // Get inquiry
    const inquiry = await inquiryRepo.findById(id);
    if (!inquiry) {
      throw new NotFoundError('Inquiry not found');
    }

    // Verify property ownership
    const property = await propertyRepo.findById(inquiry.propertyId);
    if (!property || property.managerId !== req.managerId) {
      throw new NotFoundError('Inquiry not found');
    }

    // Get conversation history
    const messages = await messageRepo.findByInquiryId(id);

    // Get responses
    const responses = await responseRepo.findByInquiryId(id);

    // Get notes
    const notes = await noteRepo.findByInquiryId(id);

    res.json({
      inquiry,
      property,
      conversationHistory: messages,
      responses,
      notes,
    });
  } catch (error) {
    next(error);
  }
});

// POST /inquiries/:id/override - Manual override actions
router.post('/:id/override', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { action, data } = req.body;

    // Validation
    if (!action || typeof action !== 'string') {
      throw new ValidationError('Action is required');
    }

    const validActions = ['qualify', 'disqualify', 'cancel_appointment', 'add_note'];
    if (!validActions.includes(action)) {
      throw new ValidationError(`Invalid action. Must be one of: ${validActions.join(', ')}`);
    }

    if (action === 'cancel_appointment' && !data?.appointmentId) {
      throw new ValidationError('Appointment ID is required for cancel_appointment action');
    }

    if (action === 'add_note' && !data?.note) {
      throw new ValidationError('Note content is required for add_note action');
    }

    const pool = getPool();
    const inquiryRepo = new InquiryRepository(pool);
    const propertyRepo = new PropertyRepository(pool);

    // Get inquiry and verify ownership
    const inquiry = await inquiryRepo.findById(id);
    if (!inquiry) {
      throw new NotFoundError('Inquiry not found');
    }

    const property = await propertyRepo.findById(inquiry.propertyId);
    if (!property || property.managerId !== req.managerId) {
      throw new NotFoundError('Inquiry not found');
    }

    // Execute override action
    const orchestrator = new WorkflowOrchestrator(pool);
    await orchestrator.manualOverride(id, { type: action as any, data }, req.managerId!);

    // Get updated inquiry
    const updatedInquiry = await inquiryRepo.findById(id);

    res.json({
      message: 'Override action completed successfully',
      inquiry: updatedInquiry,
    });
  } catch (error) {
    next(error);
  }
});

// POST /inquiries/:id/notes - Add notes
router.post('/:id/notes', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    // Validation
    if (!note || typeof note !== 'string') {
      throw new ValidationError('Note content is required');
    }

    const pool = getPool();
    const inquiryRepo = new InquiryRepository(pool);
    const propertyRepo = new PropertyRepository(pool);
    const noteRepo = new InquiryNoteRepository(pool);

    // Get inquiry and verify ownership
    const inquiry = await inquiryRepo.findById(id);
    if (!inquiry) {
      throw new NotFoundError('Inquiry not found');
    }

    const property = await propertyRepo.findById(inquiry.propertyId);
    if (!property || property.managerId !== req.managerId) {
      throw new NotFoundError('Inquiry not found');
    }

    // Add note
    const savedNote = await noteRepo.create({
      inquiryId: id,
      note,
      createdBy: req.managerId!,
    });

    res.status(201).json(savedNote);
  } catch (error) {
    next(error);
  }
});

export default router;
