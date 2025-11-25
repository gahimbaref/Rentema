import { Pool } from 'pg';
import { Inquiry } from '../models';
import {
  InquiryRepository,
  PropertyRepository,
  ResponseRepository,
  InquiryNoteRepository,
  AppointmentRepository
} from '../database/repositories';
import { QualificationEngine } from './QualificationEngine';
import { MessagingEngine } from './MessagingEngine';
import { TemplateEngine } from './TemplateEngine';
import { SchedulingEngine } from './SchedulingEngine';
import { 
  WorkflowStateError, 
  NotFoundError,
  ValidationError 
} from '../api/middleware/errorHandler';

export interface OverrideAction {
  type: 'qualify' | 'disqualify' | 'cancel_appointment' | 'add_note';
  data?: any;
}

/**
 * Workflow Orchestrator
 * Coordinates the automated workflow from inquiry to scheduling
 */
export class WorkflowOrchestrator {
  private inquiryRepo: InquiryRepository;
  private propertyRepo: PropertyRepository;
  private responseRepo: ResponseRepository;
  private noteRepo: InquiryNoteRepository;
  private appointmentRepo: AppointmentRepository;
  private qualificationEngine: QualificationEngine;
  private messagingEngine: MessagingEngine;
  private templateEngine: TemplateEngine;
  private schedulingEngine: SchedulingEngine;

  constructor(pool: Pool, redisUrl?: string) {
    this.inquiryRepo = new InquiryRepository(pool);
    this.propertyRepo = new PropertyRepository(pool);
    this.responseRepo = new ResponseRepository(pool);
    this.noteRepo = new InquiryNoteRepository(pool);
    this.appointmentRepo = new AppointmentRepository(pool);
    this.qualificationEngine = new QualificationEngine(pool);
    this.messagingEngine = new MessagingEngine(pool, redisUrl);
    this.templateEngine = new TemplateEngine(pool);
    this.schedulingEngine = new SchedulingEngine(pool);
  }

  /**
   * Process a new inquiry
   * - Snapshot questions for the inquiry
   * - Update inquiry status to 'pre_qualifying'
   * - Send first pre-qualification question
   */
  async processNewInquiry(inquiry: Inquiry): Promise<void> {
    try {
      // Get property details
      const property = await this.propertyRepo.findById(inquiry.propertyId);
      if (!property) {
        throw new NotFoundError(`Property ${inquiry.propertyId} not found`);
      }

      // Snapshot questions for this inquiry
      await this.qualificationEngine.snapshotQuestionsForInquiry(inquiry.id, inquiry.propertyId);

      // Get questions for the inquiry
      const questions = await this.qualificationEngine.getQuestionsForInquiry(inquiry.id);
      
      if (questions.length === 0) {
        // No questions configured, mark as qualified immediately
        await this.inquiryRepo.updateStatus(inquiry.id, 'qualified');
        return;
      }

      // Update inquiry status to pre_qualifying
      await this.inquiryRepo.updateStatus(inquiry.id, 'pre_qualifying');

      // Get the first question (sorted by order)
      const sortedQuestions = questions.sort((a, b) => a.order - b.order);
      const firstQuestion = sortedQuestions[0];

      // Render the question message
      const questionMessage = await this.templateEngine.renderTemplate(
        property.managerId,
        'pre_qualification_question',
        {
          questionText: firstQuestion.text
        }
      );

      // Send the first question
      await this.messagingEngine.sendMessage({
        inquiryId: inquiry.id,
        platformId: inquiry.platformId,
        recipientId: inquiry.prospectiveTenantId,
        content: questionMessage,
        priority: 'normal'
      });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      throw new WorkflowStateError('Failed to process new inquiry', inquiry.status);
    }
  }

  /**
   * Process a response from a prospective tenant
   * - Save the response
   * - Send next question or complete pre-qualification
   * - Trigger qualification evaluation when complete
   */
  async processResponse(inquiryId: string, questionId: string, responseValue: any): Promise<void> {
    // Get the inquiry
    const inquiry = await this.inquiryRepo.findById(inquiryId);
    if (!inquiry) {
      throw new Error(`Inquiry ${inquiryId} not found`);
    }

    // Get property details
    const property = await this.propertyRepo.findById(inquiry.propertyId);
    if (!property) {
      throw new Error(`Property ${inquiry.propertyId} not found`);
    }

    // Save the response
    await this.qualificationEngine.saveResponse(inquiryId, questionId, responseValue);

    // Get all questions for this inquiry
    const questions = await this.qualificationEngine.getQuestionsForInquiry(inquiryId);
    const sortedQuestions = questions.sort((a, b) => a.order - b.order);

    // Get all responses for this inquiry
    const responses = await this.responseRepo.findByInquiryId(inquiryId);

    // Check if all questions have been answered
    if (responses.length >= questions.length) {
      // All questions answered - evaluate qualification
      const qualificationResult = await this.qualificationEngine.evaluateQualification(inquiryId);
      
      // Update inquiry with qualification result
      await this.inquiryRepo.updateQualificationResult(inquiryId, qualificationResult);

      // Handle the qualification result
      await this.handleQualificationResult(inquiry, property, qualificationResult);
    } else {
      // Find the next unanswered question
      const answeredQuestionIds = new Set(responses.map(r => r.questionId));
      const nextQuestion = sortedQuestions.find(q => !answeredQuestionIds.has(q.id));

      if (nextQuestion) {
        // Render and send the next question
        const questionMessage = await this.templateEngine.renderTemplate(
          property.managerId,
          'pre_qualification_question',
          {
            questionText: nextQuestion.text
          }
        );

        await this.messagingEngine.sendMessage({
          inquiryId: inquiry.id,
          platformId: inquiry.platformId,
          recipientId: inquiry.prospectiveTenantId,
          content: questionMessage,
          priority: 'normal'
        });
      }
    }
  }

  /**
   * Handle qualification result
   * - Send rejection message for disqualified inquiries
   * - Trigger scheduling workflow for qualified inquiries
   * - Notify property manager
   */
  private async handleQualificationResult(
    inquiry: Inquiry,
    property: any,
    qualificationResult: any
  ): Promise<void> {
    if (qualificationResult.qualified) {
      // Mark as qualified
      await this.inquiryRepo.updateStatus(inquiry.id, 'qualified');

      // Send success message
      const successMessage = await this.templateEngine.renderTemplate(
        property.managerId,
        'qualification_success',
        {
          tenantName: inquiry.prospectiveTenantName || 'there',
          propertyAddress: property.address
        }
      );

      await this.messagingEngine.sendMessage({
        inquiryId: inquiry.id,
        platformId: inquiry.platformId,
        recipientId: inquiry.prospectiveTenantId,
        content: successMessage,
        priority: 'high'
      });

      // Send video call offer message
      // Note: In a full implementation, this would generate actual available time slots
      // For now, we'll send a placeholder message
      const videoCallMessage = await this.templateEngine.renderTemplate(
        property.managerId,
        'video_call_offer',
        {
          tenantName: inquiry.prospectiveTenantName || 'there',
          propertyAddress: property.address,
          timeSlots: ['Monday 10:00 AM', 'Tuesday 2:00 PM', 'Wednesday 4:00 PM']
        }
      );

      await this.messagingEngine.sendMessage({
        inquiryId: inquiry.id,
        platformId: inquiry.platformId,
        recipientId: inquiry.prospectiveTenantId,
        content: videoCallMessage,
        priority: 'high'
      });

      // TODO: Notify property manager (would require notification system)
    } else {
      // Mark as disqualified
      await this.inquiryRepo.updateStatus(inquiry.id, 'disqualified');

      // Send rejection message
      const rejectionMessage = await this.templateEngine.renderTemplate(
        property.managerId,
        'qualification_failure',
        {
          tenantName: inquiry.prospectiveTenantName || 'there',
          propertyAddress: property.address
        }
      );

      await this.messagingEngine.sendMessage({
        inquiryId: inquiry.id,
        platformId: inquiry.platformId,
        recipientId: inquiry.prospectiveTenantId,
        content: rejectionMessage,
        priority: 'normal'
      });

      // TODO: Notify property manager (would require notification system)
    }
  }

  /**
   * Manual override functionality
   * Allows property managers to manually intervene in the automated workflow
   * - qualify: Manually mark an inquiry as qualified
   * - disqualify: Manually mark an inquiry as disqualified
   * - cancel_appointment: Cancel a scheduled appointment
   * - add_note: Add a note to an inquiry
   */
  async manualOverride(inquiryId: string, action: OverrideAction, managerId: string): Promise<void> {
    const inquiry = await this.inquiryRepo.findById(inquiryId);
    if (!inquiry) {
      throw new Error(`Inquiry ${inquiryId} not found`);
    }

    const property = await this.propertyRepo.findById(inquiry.propertyId);
    if (!property) {
      throw new Error(`Property ${inquiry.propertyId} not found`);
    }

    switch (action.type) {
      case 'qualify':
        // Manually mark as qualified
        await this.inquiryRepo.updateStatus(inquiryId, 'qualified');
        
        // Update qualification result
        await this.inquiryRepo.updateQualificationResult(inquiryId, {
          qualified: true
        });

        // Trigger scheduling workflow
        await this.handleQualificationResult(inquiry, property, { qualified: true });
        break;

      case 'disqualify':
        // Manually mark as disqualified
        await this.inquiryRepo.updateStatus(inquiryId, 'disqualified');
        
        // Update qualification result
        await this.inquiryRepo.updateQualificationResult(inquiryId, {
          qualified: false
        });

        // Send rejection message
        const rejectionMessage = await this.templateEngine.renderTemplate(
          property.managerId,
          'qualification_failure',
          {
            tenantName: inquiry.prospectiveTenantName || 'there',
            propertyAddress: property.address
          }
        );

        await this.messagingEngine.sendMessage({
          inquiryId: inquiry.id,
          platformId: inquiry.platformId,
          recipientId: inquiry.prospectiveTenantId,
          content: rejectionMessage,
          priority: 'normal'
        });
        break;

      case 'cancel_appointment':
        // Cancel appointment
        if (!action.data?.appointmentId) {
          throw new Error('Appointment ID is required for cancel_appointment action');
        }

        const appointment = await this.schedulingEngine.cancelAppointment(action.data.appointmentId);

        // Send cancellation notification
        const cancellationMessage = `Your appointment for ${property.address} scheduled for ${appointment.scheduledTime.toLocaleString()} has been cancelled. We apologize for any inconvenience.`;

        await this.messagingEngine.sendMessage({
          inquiryId: inquiry.id,
          platformId: inquiry.platformId,
          recipientId: inquiry.prospectiveTenantId,
          content: cancellationMessage,
          priority: 'high'
        });
        break;

      case 'add_note':
        // Add note to inquiry
        if (!action.data?.note) {
          throw new Error('Note content is required for add_note action');
        }

        await this.noteRepo.create({
          inquiryId: inquiryId,
          note: action.data.note,
          createdBy: managerId
        });
        break;

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  /**
   * Handle timeout for non-responsive tenants
   * Send reminder messages when tenants don't respond within expected timeframe
   */
  async handleTimeout(inquiryId: string): Promise<void> {
    const inquiry = await this.inquiryRepo.findById(inquiryId);
    if (!inquiry) {
      throw new Error(`Inquiry ${inquiryId} not found`);
    }

    const property = await this.propertyRepo.findById(inquiry.propertyId);
    if (!property) {
      throw new Error(`Property ${inquiry.propertyId} not found`);
    }

    // Only send reminders for inquiries in pre_qualifying status
    if (inquiry.status !== 'pre_qualifying') {
      return;
    }

    // Get the questions and responses to determine which question to remind about
    const questions = await this.qualificationEngine.getQuestionsForInquiry(inquiryId);
    const responses = await this.responseRepo.findByInquiryId(inquiryId);
    const sortedQuestions = questions.sort((a, b) => a.order - b.order);

    // Find the next unanswered question
    const answeredQuestionIds = new Set(responses.map(r => r.questionId));
    const nextQuestion = sortedQuestions.find(q => !answeredQuestionIds.has(q.id));

    if (nextQuestion) {
      // Send reminder message
      const reminderMessage = `Hi ${inquiry.prospectiveTenantName || 'there'}, we're still waiting for your response to our question about ${property.address}. Please reply when you have a chance: ${nextQuestion.text}`;

      await this.messagingEngine.sendMessage({
        inquiryId: inquiry.id,
        platformId: inquiry.platformId,
        recipientId: inquiry.prospectiveTenantId,
        content: reminderMessage,
        priority: 'normal'
      });
    }
  }

  /**
   * Send tour confirmation message
   * Called after a tour appointment is scheduled
   */
  async sendTourConfirmation(inquiryId: string, appointmentId: string): Promise<void> {
    const inquiry = await this.inquiryRepo.findById(inquiryId);
    if (!inquiry) {
      throw new Error(`Inquiry ${inquiryId} not found`);
    }

    const property = await this.propertyRepo.findById(inquiry.propertyId);
    if (!property) {
      throw new Error(`Property ${inquiry.propertyId} not found`);
    }

    // Get appointment details
    const appointment = await this.appointmentRepo.findById(appointmentId);
    if (!appointment) {
      throw new Error(`Appointment ${appointmentId} not found`);
    }

    // Send tour confirmation message
    const confirmationMessage = await this.templateEngine.renderTemplate(
      property.managerId,
      'tour_confirmation',
      {
        appointmentTime: appointment.scheduledTime.toLocaleString(),
        propertyAddress: property.address
      }
    );

    await this.messagingEngine.sendMessage({
      inquiryId: inquiry.id,
      platformId: inquiry.platformId,
      recipientId: inquiry.prospectiveTenantId,
      content: confirmationMessage,
      priority: 'high'
    });

    // Update inquiry status
    await this.inquiryRepo.updateStatus(inquiryId, 'tour_scheduled');
  }

  /**
   * Close messaging engine connections (for graceful shutdown)
   */
  async close(): Promise<void> {
    await this.messagingEngine.close();
  }
}
