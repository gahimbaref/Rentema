import { Pool } from 'pg';
import { BookingTokenRepository } from '../database/repositories/BookingTokenRepository';
import { SchedulingEngine } from './SchedulingEngine';
import { InquiryRepository } from '../database/repositories/InquiryRepository';
import { PropertyRepository } from '../database/repositories/PropertyRepository';
import { logger } from '../utils/logger';

export interface SchedulingOptions {
  appointmentType: 'video_call' | 'tour';
  daysAhead?: number;
  minSlotsToShow?: number;
  duration?: number;
}

export interface TimeSlot {
  startTime: Date;
  endTime: Date;
  bookingToken: string;
  bookingUrl: string;
}

export interface SchedulingLinks {
  inquiryId: string;
  slots: TimeSlot[];
  expiresAt: Date;
}

export class SchedulingLinkGenerator {
  private bookingTokenRepo: BookingTokenRepository;
  private schedulingEngine: SchedulingEngine;
  private inquiryRepo: InquiryRepository;
  private propertyRepo: PropertyRepository;

  constructor(pool: Pool) {
    this.bookingTokenRepo = new BookingTokenRepository(pool);
    this.schedulingEngine = new SchedulingEngine(pool);
    this.inquiryRepo = new InquiryRepository(pool);
    this.propertyRepo = new PropertyRepository(pool);
  }

  async generateSchedulingLinks(
    inquiryId: string,
    options: SchedulingOptions = { appointmentType: 'tour' }
  ): Promise<SchedulingLinks> {
    try {
      logger.info('Generating scheduling links', { inquiryId, options });

      // Get inquiry and property
      const inquiry = await this.inquiryRepo.findById(inquiryId);
      if (!inquiry) {
        throw new Error('Inquiry not found');
      }

      if (!inquiry.propertyId) {
        throw new Error('Inquiry has no associated property');
      }

      const property = await this.propertyRepo.findById(inquiry.propertyId);
      if (!property) {
        throw new Error('Property not found');
      }

      // Get manager's availability
      const daysAhead = options.daysAhead || 7;
      const minSlots = options.minSlotsToShow || 5;
      const duration = options.duration || 30;

      // Collect slots from multiple days
      const allSlots: TimeSlot[] = [];
      const today = new Date();
      
      for (let dayOffset = 0; dayOffset < daysAhead && allSlots.length < minSlots * 2; dayOffset++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() + dayOffset);
        
        const daySlots = await this.schedulingEngine.getAvailableSlots(
          property.managerId,
          options.appointmentType,
          checkDate,
          duration
        );
        
        allSlots.push(...daySlots.map(slot => ({
          startTime: slot.startTime,
          endTime: slot.endTime,
          bookingToken: '',
          bookingUrl: ''
        })));
      }

      if (allSlots.length === 0) {
        logger.warn('No available slots found', { inquiryId, managerId: property.managerId });
        throw new Error('No available time slots found');
      }

      // Take the first N slots
      const slotsToUse = allSlots.slice(0, Math.max(minSlots, 10));

      // Generate booking tokens for each slot
      const slots: TimeSlot[] = [];
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + daysAhead);

      for (const slot of slotsToUse) {
        const tokenData = await this.bookingTokenRepo.create({
          inquiryId,
          slotStartTime: slot.startTime,
          slotEndTime: slot.endTime,
          appointmentType: options.appointmentType,
          expiresInDays: daysAhead,
        });

        const bookingUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/booking/${tokenData.token}`;

        slots.push({
          startTime: slot.startTime,
          endTime: slot.endTime,
          bookingToken: tokenData.token,
          bookingUrl,
        });
      }

      logger.info('Scheduling links generated', { inquiryId, slotCount: slots.length });

      return {
        inquiryId,
        slots,
        expiresAt,
      };
    } catch (error: any) {
      logger.error('Failed to generate scheduling links', { inquiryId, error: error.message });
      throw error;
    }
  }

  async validateBookingLink(token: string): Promise<{
    isValid: boolean;
    slotInfo?: {
      startTime: Date;
      endTime: Date;
      appointmentType: string;
    };
    error?: 'expired' | 'already_booked' | 'not_found';
  }> {
    const isValid = await this.bookingTokenRepo.isValid(token);

    if (!isValid) {
      const tokenData = await this.bookingTokenRepo.findByToken(token);
      
      if (!tokenData) {
        return { isValid: false, error: 'not_found' };
      }

      if (tokenData.isUsed) {
        return { isValid: false, error: 'already_booked' };
      }

      return { isValid: false, error: 'expired' };
    }

    const tokenData = await this.bookingTokenRepo.findByToken(token);
    
    return {
      isValid: true,
      slotInfo: {
        startTime: tokenData!.slotStartTime,
        endTime: tokenData!.slotEndTime,
        appointmentType: tokenData!.appointmentType,
      },
    };
  }

  async bookAppointment(token: string): Promise<string> {
    try {
      logger.info('Booking appointment', { token });

      // Validate token
      const validation = await this.validateBookingLink(token);

      if (!validation.isValid) {
        throw new Error(`Invalid booking link: ${validation.error}`);
      }

      // Get token data
      const tokenData = await this.bookingTokenRepo.findByToken(token);
      if (!tokenData) {
        throw new Error('Token not found');
      }

      // Get inquiry
      const inquiry = await this.inquiryRepo.findById(tokenData.inquiryId);
      if (!inquiry) {
        throw new Error('Inquiry not found');
      }

      // Get property details
      const property = inquiry.propertyId ? await this.propertyRepo.findById(inquiry.propertyId) : null;

      // Create appointment using scheduling engine
      const appointment = await this.schedulingEngine.scheduleAppointment({
        inquiryId: tokenData.inquiryId,
        type: tokenData.appointmentType,
        scheduledTime: tokenData.slotStartTime,
        duration: Math.round((tokenData.slotEndTime.getTime() - tokenData.slotStartTime.getTime()) / 60000),
      });

      // Mark token as used
      await this.bookingTokenRepo.markAsUsed(token);

      // Update inquiry status based on appointment type
      const newStatus = tokenData.appointmentType === 'video_call' ? 'video_call_scheduled' : 'tour_scheduled';
      await this.inquiryRepo.updateStatus(tokenData.inquiryId, newStatus);

      // Send confirmation email
      await this.sendConfirmationEmail(inquiry, appointment, property);

      logger.info('Appointment booked successfully', {
        appointmentId: appointment.id,
        inquiryId: tokenData.inquiryId,
        startTime: tokenData.slotStartTime,
      });

      return appointment.id;
    } catch (error: any) {
      logger.error('Failed to book appointment', { token, error: error.message });
      throw error;
    }
  }

  private async sendConfirmationEmail(inquiry: any, appointment: any, property: any): Promise<void> {
    try {
      // Import dependencies dynamically to avoid circular dependency
      const { EmailSenderService } = await import('./EmailSenderService');
      const { getDatabasePool } = await import('../database/connection');
      
      const pool = getDatabasePool();
      const emailSender = new EmailSenderService(pool);

      // Get connection ID from inquiry metadata, with fallback
      let connectionId = inquiry.sourceMetadata?.connectionId;
      
      // Check if connection exists, fall back to active connection if not
      if (connectionId) {
        const connectionCheck = await pool.query(
          'SELECT id FROM email_connections WHERE id = $1',
          [connectionId]
        );
        if (connectionCheck.rows.length === 0) {
          logger.warn('Connection ID from inquiry metadata not found, looking for active connection', {
            inquiryId: inquiry.id,
            oldConnectionId: connectionId,
          });
          connectionId = undefined;
        }
      }
      
      // Fall back to any active connection
      if (!connectionId) {
        const activeConnection = await pool.query(
          'SELECT id FROM email_connections ORDER BY created_at DESC LIMIT 1'
        );
        if (activeConnection.rows.length > 0) {
          connectionId = activeConnection.rows[0].id;
          logger.info('Using fallback connection ID for confirmation email', { inquiryId: inquiry.id, connectionId });
        } else {
          logger.warn('No email connection available, skipping confirmation email', { inquiryId: inquiry.id });
          return;
        }
      }

      // Get tenant email
      const tenantEmail = inquiry.sourceMetadata?.tenantEmail;
      if (!tenantEmail) {
        logger.warn('No tenant email found, skipping confirmation email', { inquiryId: inquiry.id });
        return;
      }

      // Format appointment details
      const appointmentDate = appointment.scheduledTime.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });

      const appointmentTime = appointment.scheduledTime.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });

      // Format video call link if present (check both zoomLink and googleMeetLink for compatibility)
      let videoCallLinkHtml = '';
      const meetLink = appointment.googleMeetLink || appointment.zoomLink;
      if (meetLink) {
        videoCallLinkHtml = `<p><strong>Video Call Link:</strong> <a href="${meetLink}" style="color: #667eea; text-decoration: none; font-weight: 500;">Join Google Meet</a></p>
        <p style="font-size: 12px; color: #666;"><em>Note: A calendar invite with the meeting link will be sent separately.</em></p>`;
      }

      // Send confirmation email
      await emailSender.sendTemplatedEmail(
        property?.managerId || '00000000-0000-0000-0000-000000000001',
        'appointment_confirmation',
        {
          inquiryId: inquiry.id,
          tenantName: inquiry.prospectiveTenantName || 'there',
          tenantEmail,
          propertyAddress: property?.address || 'the property',
          appointmentDate,
          appointmentTime,
          appointmentDuration: appointment.duration.toString(),
          videoCallLink: videoCallLinkHtml,
          cancellationLink: `${process.env.CLIENT_URL || 'http://localhost:3000'}/cancel/${appointment.id}`,
          managerName: 'Property Manager',
          managerEmail: process.env.MANAGER_EMAIL || 'manager@example.com',
          managerPhone: process.env.MANAGER_PHONE || '(555) 123-4567',
        },
        connectionId
      );

      logger.info('Confirmation email sent', { inquiryId: inquiry.id, appointmentId: appointment.id });
    } catch (error: any) {
      logger.error('Failed to send confirmation email', { inquiryId: inquiry.id, error: error.message });
      // Don't throw - booking was successful even if email fails
    }
  }

  formatTimeSlotForEmail(slot: TimeSlot): string {
    const date = slot.startTime.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });

    const time = slot.startTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    return `<a href="${slot.bookingUrl}" style="display: block; padding: 15px; margin: 10px 0; background: #f8f9ff; border: 2px solid #667eea; border-radius: 8px; text-decoration: none; color: #333; text-align: center; font-weight: 500;">${date} at ${time}</a>`;
  }
}
