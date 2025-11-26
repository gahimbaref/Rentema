import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { QuestionnaireTokenService } from '../../engines/QuestionnaireTokenService';
import { InquiryRepository } from '../../database/repositories/InquiryRepository';
import { PropertyRepository } from '../../database/repositories/PropertyRepository';
import { QuestionRepository } from '../../database/repositories/QuestionRepository';
import { ResponseRepository } from '../../database/repositories/ResponseRepository';
import { EmailWorkflowOrchestrator } from '../../engines/EmailWorkflowOrchestrator';
import { logger } from '../../utils/logger';

export function createPublicQuestionnaireRouter(pool: Pool): Router {
  const router = Router();
  const tokenService = new QuestionnaireTokenService(pool);
  const inquiryRepo = new InquiryRepository(pool);
  const propertyRepo = new PropertyRepository(pool);
  const questionRepo = new QuestionRepository(pool);
  const responseRepo = new ResponseRepository(pool);
  const workflowOrchestrator = new EmailWorkflowOrchestrator(pool);

  // GET /public/questionnaire/:token
  // Load questionnaire for a given token
  router.get('/:token', async (req: Request, res: Response) => {
    try {
      const { token } = req.params;

      // Validate token
      const validation = await tokenService.validateToken(token);

      if (!validation.isValid) {
        return res.status(400).json({
          error: 'Invalid or expired token',
          code: validation.error,
        });
      }

      // Get inquiry
      const inquiry = await inquiryRepo.findById(validation.inquiryId!);

      if (!inquiry) {
        return res.status(404).json({ error: 'Inquiry not found' });
      }

      // Get property details
      let propertyDetails = null;
      if (inquiry.propertyId) {
        const property = await propertyRepo.findById(inquiry.propertyId);
        if (property) {
          propertyDetails = {
            address: property.address,
            bedrooms: property.bedrooms,
            bathrooms: property.bathrooms,
            rent: property.rent,
          };
        }
      }

      // Get questions for this property
      const questions = inquiry.propertyId
        ? await questionRepo.findByPropertyId(inquiry.propertyId)
        : [];

      res.json({
        inquiryId: inquiry.id,
        tenantName: inquiry.prospectiveTenantName || 'there',
        propertyAddress: propertyDetails?.address || 'Property',
        propertyDetails,
        questions: questions.map(q => ({
          id: q.id,
          text: q.text,
          type: q.responseType,
          required: true, // All questions are required for now
          options: q.options,
        })),
      });
    } catch (error: any) {
      logger.error('Error loading questionnaire', { error: error.message, token: req.params.token });
      res.status(500).json({ error: 'Failed to load questionnaire' });
    }
  });


  // POST /public/questionnaire/:token/submit
  // Submit questionnaire responses
  router.post('/:token/submit', async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const { responses } = req.body;

      // Validate token
      const validation = await tokenService.validateToken(token);

      if (!validation.isValid) {
        return res.status(400).json({
          error: 'Invalid or expired token',
          code: validation.error,
        });
      }

      const inquiryId = validation.inquiryId!;

      // Validate responses
      if (!responses || !Array.isArray(responses)) {
        return res.status(400).json({ error: 'Invalid responses format' });
      }

      // Get inquiry
      const inquiry = await inquiryRepo.findById(inquiryId);

      if (!inquiry) {
        return res.status(404).json({ error: 'Inquiry not found' });
      }

      // Get questions to validate required fields
      const questions = inquiry.propertyId
        ? await questionRepo.findByPropertyId(inquiry.propertyId)
        : [];

      // Check required questions (all questions are required for now)
      const answeredQuestionIds = responses.map((r: any) => r.questionId);

      for (const question of questions) {
        if (!answeredQuestionIds.includes(question.id)) {
          return res.status(400).json({
            error: 'Missing required question',
            questionId: question.id,
          });
        }
      }

      // Save responses
      for (const response of responses) {
        await responseRepo.create({
          inquiryId,
          questionId: response.questionId,
          value: response.value,
        });
      }

      // Mark token as used
      await tokenService.markTokenUsed(token);

      // Update inquiry status
      await inquiryRepo.updateStatus(inquiryId, 'questionnaire_completed');

      logger.info('Questionnaire submitted', { inquiryId, responseCount: responses.length });

      // Trigger qualification workflow (async, don't wait for it)
      workflowOrchestrator.handleQuestionnaireSubmission(inquiryId).catch(err => {
        logger.error('Error in qualification workflow', { inquiryId, error: err.message });
      });

      res.json({
        success: true,
        message: 'Thank you for completing the questionnaire!',
        nextStep: 'pending', // Will be updated by qualification workflow
      });
    } catch (error: any) {
      logger.error('Error submitting questionnaire', { error: error.message, token: req.params.token });
      res.status(500).json({ error: 'Failed to submit questionnaire' });
    }
  });

  return router;
}
