import { Pool } from 'pg';
import { EmailSenderService } from './EmailSenderService';
import { QuestionnaireTokenService } from './QuestionnaireTokenService';
import { SchedulingLinkGenerator } from './SchedulingLinkGenerator';
import { QualificationEngine } from './QualificationEngine';
import { InquiryRepository } from '../database/repositories/InquiryRepository';
import { PropertyRepository } from '../database/repositories/PropertyRepository';
import { logger } from '../utils/logger';

export interface WorkflowStatus {
  inquiryId: string;
  currentStage: 'questionnaire_sent' | 'questionnaire_completed' | 'qualified' | 'disqualified' | 'scheduling_sent' | 'appointment_booked';
  questionnaireSentAt?: Date;
  questionnaireCompletedAt?: Date;
  qualificationResult?: 'qualified' | 'disqualified';
  schedulingEmailSentAt?: Date;
  appointmentBookedAt?: Date;
  errors: string[];
}

export class EmailWorkflowOrchestrator {
  private pool: Pool;
  private emailSender: EmailSenderService;
  private tokenService: QuestionnaireTokenService;
  private schedulingLinkGen: SchedulingLinkGenerator;
  private qualificationEngine: QualificationEngine;
  private inquiryRepo: InquiryRepository;
  private propertyRepo: PropertyRepository;

  constructor(pool: Pool) {
    this.pool = pool;
    this.emailSender = new EmailSenderService(pool);
    this.tokenService = new QuestionnaireTokenService(pool);
    this.schedulingLinkGen = new SchedulingLinkGenerator(pool);
    this.qualificationEngine = new QualificationEngine(pool);
    this.inquiryRepo = new InquiryRepository(pool);
    this.propertyRepo = new PropertyRepository(pool);
  }

  async startEmailWorkflow(inquiryId: string, connectionId: string): Promise<void> {
    try {
      logger.info('Starting email workflow', { inquiryId });

      // Get inquiry details
      const inquiry = await this.inquiryRepo.findById(inquiryId);
      if (!inquiry) {
        throw new Error('Inquiry not found');
      }

      // Get property details
      let property = null;
      let managerId = null;
      if (inquiry.propertyId) {
        property = await this.propertyRepo.findById(inquiry.propertyId);
        managerId = property?.managerId;
      }

      if (!managerId) {
        throw new Error('Manager ID not found for inquiry');
      }

      // Generate questionnaire token
      const token = await this.tokenService.generateToken(inquiryId, 7);

      // Build questionnaire link
      const questionnaireLink = `${process.env.CLIENT_URL || 'http://localhost:5173'}/questionnaire/${token.token}`;

      // Calculate expiration date
      const expirationDate = new Date(token.expiresAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });

      // Get manager details (would come from inquiry or property)
      const managerName = 'Property Manager'; // TODO: Get from database
      const managerEmail = process.env.MANAGER_EMAIL || 'manager@example.com';
      const managerPhone = process.env.MANAGER_PHONE || '(555) 123-4567';

      // Extract tenant email from source metadata
      const tenantEmail = inquiry.sourceMetadata?.tenantEmail;
      if (!tenantEmail) {
        throw new Error('Tenant email not found in inquiry metadata');
      }

      // Send questionnaire email
      await this.emailSender.sendTemplatedEmail(
        managerId,
        'questionnaire',
        {
          inquiryId,
          tenantName: inquiry.prospectiveTenantName || 'there',
          tenantEmail,
          propertyAddress: property?.address || 'the property',
          questionnaireLink,
          expirationDate,
          managerName,
          managerEmail,
          managerPhone,
        },
        connectionId
      );

      // Update inquiry status to pre_qualifying
      await this.inquiryRepo.updateStatus(inquiryId, 'pre_qualifying');

      logger.info('Email workflow started successfully', { inquiryId, questionnaireLink });
    } catch (error: any) {
      logger.error('Failed to start email workflow', { inquiryId, error: error.message });
      throw error;
    }
  }


  async handleQuestionnaireSubmission(inquiryId: string): Promise<void> {
    try {
      logger.info('Handling questionnaire submission', { inquiryId });

      // Get inquiry
      const inquiry = await this.inquiryRepo.findById(inquiryId);
      if (!inquiry) {
        throw new Error('Inquiry not found');
      }

      // Evaluate qualification
      if (inquiry.propertyId) {
        const result = await this.qualificationEngine.evaluateQualification(inquiryId);

        logger.info('Qualification evaluation complete', {
          inquiryId,
          qualified: result.qualified,
        });

        // Handle qualification result
        await this.handleQualificationResult(inquiryId, result);
      } else {
        logger.warn('No property associated with inquiry, skipping qualification', { inquiryId });
      }
    } catch (error: any) {
      logger.error('Failed to handle questionnaire submission', { inquiryId, error: error.message });
      throw error;
    }
  }

  async handleQualificationResult(inquiryId: string, result: any): Promise<void> {
    try {
      const inquiry = await this.inquiryRepo.findById(inquiryId);
      if (!inquiry) {
        throw new Error('Inquiry not found');
      }

      // Get connection ID - try from inquiry metadata first
      let connectionId = inquiry.sourceMetadata?.connectionId;
      
      // If connection ID doesn't exist, try to find an active connection for the manager
      if (connectionId) {
        const connectionCheck = await this.pool.query(
          'SELECT id FROM email_connections WHERE id = $1',
          [connectionId]
        );
        if (connectionCheck.rows.length === 0) {
          logger.warn('Connection ID from inquiry metadata not found, looking for active connection', {
            inquiryId,
            oldConnectionId: connectionId,
          });
          connectionId = undefined;
        }
      }
      
      // Fall back to any active connection
      if (!connectionId) {
        const activeConnection = await this.pool.query(
          'SELECT id FROM email_connections ORDER BY created_at DESC LIMIT 1'
        );
        if (activeConnection.rows.length > 0) {
          connectionId = activeConnection.rows[0].id;
          logger.info('Using fallback connection ID', { inquiryId, connectionId });
        }
      }

      if (result.qualified) {
        // Update status first, before attempting to send email
        await this.inquiryRepo.updateStatus(inquiryId, 'qualified');
        
        // Generate scheduling links for video call (first step after qualification)
        const schedulingLinks = await this.schedulingLinkGen.generateSchedulingLinks(inquiryId, {
          appointmentType: 'video_call',
          daysAhead: 7,
          minSlotsToShow: 5,
        });

        // Format time slots for email
        const timeSlots = schedulingLinks.slots.map(slot => ({
          time: slot.startTime.toLocaleString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          }),
          bookingLink: slot.bookingUrl,
        }));

        // Get property details
        const property = inquiry.propertyId
          ? await this.propertyRepo.findById(inquiry.propertyId)
          : null;

        // Get manager ID
        const managerId = property?.managerId;
        if (!managerId) {
          logger.error('Manager ID not found for qualified inquiry', { inquiryId });
          return;
        }

        // Extract tenant email from source metadata
        const tenantEmail = inquiry.sourceMetadata?.tenantEmail;
        if (!tenantEmail) {
          logger.error('Tenant email not found in inquiry metadata', { inquiryId });
          return;
        }

        // Send scheduling email (if connection available)
        if (connectionId) {
          try {
            await this.emailSender.sendTemplatedEmail(
              managerId,
              'qualified_scheduling',
              {
                inquiryId,
                tenantName: inquiry.prospectiveTenantName || 'there',
                tenantEmail,
                propertyAddress: property?.address || 'the property',
                timeSlots,
                managerName: 'Property Manager',
                managerEmail: process.env.MANAGER_EMAIL || 'manager@example.com',
                managerPhone: process.env.MANAGER_PHONE || '(555) 123-4567',
              },
              connectionId
            );
            logger.info('Tenant qualified, scheduling email sent', { inquiryId, slotCount: schedulingLinks.slots.length });
          } catch (emailError: any) {
            logger.error('Failed to send scheduling email, but inquiry status updated', {
              inquiryId,
              error: emailError.message,
            });
          }
        } else {
          logger.warn('No email connection available, inquiry status updated but email not sent', { inquiryId });
        }
      } else {
        // Update status first, before attempting to send email
        await this.inquiryRepo.updateStatus(inquiryId, 'disqualified');
        
        // Send rejection email
        const property = inquiry.propertyId
          ? await this.propertyRepo.findById(inquiry.propertyId)
          : null;

        // Get manager ID
        const managerId = property?.managerId;
        if (!managerId) {
          logger.error('Manager ID not found for disqualified inquiry', { inquiryId });
          return;
        }

        // Extract tenant email from source metadata
        const tenantEmail = inquiry.sourceMetadata?.tenantEmail;
        if (!tenantEmail) {
          logger.error('Tenant email not found in inquiry metadata', { inquiryId });
          return;
        }

        if (connectionId) {
          try {
            await this.emailSender.sendTemplatedEmail(
              managerId,
              'disqualified_rejection',
              {
                inquiryId,
                tenantName: inquiry.prospectiveTenantName || 'there',
                tenantEmail,
                propertyAddress: property?.address || 'the property',
                managerName: 'Property Manager',
                managerEmail: process.env.MANAGER_EMAIL || 'manager@example.com',
                managerPhone: process.env.MANAGER_PHONE || '(555) 123-4567',
              },
              connectionId
            );
            logger.info('Tenant disqualified, rejection email sent', { inquiryId });
          } catch (emailError: any) {
            logger.error('Failed to send rejection email, but inquiry status updated', {
              inquiryId,
              error: emailError.message,
            });
          }
        } else {
          logger.warn('No email connection available, inquiry status updated but email not sent', { inquiryId });
        }
      }
    } catch (error: any) {
      logger.error('Failed to handle qualification result', { inquiryId, error: error.message });
      throw error;
    }
  }

  async getWorkflowStatus(inquiryId: string): Promise<WorkflowStatus> {
    const inquiry = await this.inquiryRepo.findById(inquiryId);
    
    if (!inquiry) {
      throw new Error('Inquiry not found');
    }

    return {
      inquiryId,
      currentStage: inquiry.status as any,
      errors: [],
    };
  }

  async resendQuestionnaire(inquiryId: string, connectionId: string): Promise<void> {
    logger.info('Resending questionnaire', { inquiryId });

    // Regenerate token
    await this.tokenService.regenerateToken(inquiryId);

    // Restart workflow with new token
    await this.startEmailWorkflow(inquiryId, connectionId);
  }
}
