import { Pool } from 'pg';
import {
  AvailabilitySchedule,
  WeeklySchedule,
  DateRange,
  TimeBlock,
  Appointment,
  AppointmentType
} from '../models';
import { AvailabilityScheduleRepository, AppointmentRepository } from '../database/repositories';
import { 
  SchedulingConflictError, 
  AvailabilityError, 
  ValidationError 
} from '../api/middleware/errorHandler';
import { GoogleMeetService } from './GoogleMeetService';
import { logger } from '../utils/logger';

export interface TimeSlot {
  startTime: Date;
  endTime: Date;
}

export interface AppointmentRequest {
  inquiryId: string;
  type: AppointmentType;
  scheduledTime: Date;
  duration: number;
  propertyAddress?: string;
}

export class SchedulingEngine {
  private availabilityRepo: AvailabilityScheduleRepository;
  private appointmentRepo: AppointmentRepository;
  private meetService: GoogleMeetService | null = null;

  constructor(pool: Pool) {
    this.availabilityRepo = new AvailabilityScheduleRepository(pool);
    this.appointmentRepo = new AppointmentRepository(pool);

    // Initialize Google Meet service if credentials are available
    if (process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN) {
      this.meetService = new GoogleMeetService(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        process.env.GMAIL_REDIRECT_URI || 'http://localhost:5000/api/email/callback',
        process.env.GMAIL_REFRESH_TOKEN
      );
      logger.info('Google Meet service initialized');
    } else {
      logger.warn('Google Meet credentials not configured, will use placeholder links');
    }
  }

  /**
   * Set availability schedule for a manager
   * Supports separate schedules for video calls and tours
   */
  async setAvailability(
    managerId: string,
    scheduleType: 'video_call' | 'tour',
    recurringWeekly: WeeklySchedule,
    blockedDates: DateRange[] = []
  ): Promise<AvailabilitySchedule> {
    // Validate schedule data
    this.validateWeeklySchedule(recurringWeekly);
    this.validateBlockedDates(blockedDates);

    try {
      // Check if schedule already exists
      const existing = await this.availabilityRepo.findByManagerAndType(managerId, scheduleType);

      if (existing) {
        // Update existing schedule
        const updated = await this.availabilityRepo.update(existing.id, recurringWeekly, blockedDates);
        if (!updated) {
          throw new AvailabilityError('Failed to update availability schedule');
        }
        return updated;
      } else {
        // Create new schedule
        return await this.availabilityRepo.create({
          managerId,
          scheduleType,
          recurringWeekly,
          blockedDates
        });
      }
    } catch (error) {
      if (error instanceof AvailabilityError || error instanceof ValidationError) {
        throw error;
      }
      throw new AvailabilityError('Failed to set availability schedule');
    }
  }

  /**
   * Get availability schedule for a manager
   */
  async getAvailability(
    managerId: string,
    scheduleType: 'video_call' | 'tour'
  ): Promise<AvailabilitySchedule | null> {
    return await this.availabilityRepo.findByManagerAndType(managerId, scheduleType);
  }

  /**
   * Generate available time slots based on availability schedule
   * Excludes blocked dates and existing appointments
   */
  async getAvailableSlots(
    managerId: string,
    appointmentType: AppointmentType,
    date: Date,
    slotDuration: number = 30
  ): Promise<TimeSlot[]> {
    // Get availability schedule
    const schedule = await this.availabilityRepo.findByManagerAndType(managerId, appointmentType);
    if (!schedule) {
      return [];
    }

    const slots: TimeSlot[] = [];
    const dayOfWeek = this.getDayName(date);
    const timeBlocks = schedule.recurringWeekly[dayOfWeek] || [];

    // Check if date is blocked
    if (this.isDateBlocked(date, schedule.blockedDates)) {
      return [];
    }

    // Generate slots from time blocks
    for (const block of timeBlocks) {
      const blockSlots = this.generateSlotsFromTimeBlock(date, block, slotDuration);
      slots.push(...blockSlots);
    }

    // Filter out slots that overlap with existing appointments
    const availableSlots: TimeSlot[] = [];
    for (const slot of slots) {
      const overlapping = await this.appointmentRepo.findOverlapping(slot.startTime, slotDuration);
      if (overlapping.length === 0) {
        availableSlots.push(slot);
      }
    }

    return availableSlots;
  }

  /**
   * Schedule an appointment
   * Checks for conflicts before creating
   * Creates Zoom meeting for video calls
   */
  async scheduleAppointment(request: AppointmentRequest): Promise<Appointment> {
    // Validate request
    if (!request.inquiryId || !request.type || !request.scheduledTime || !request.duration) {
      throw new ValidationError('Missing required appointment fields');
    }

    if (request.duration <= 0) {
      throw new ValidationError('Appointment duration must be positive');
    }

    if (request.scheduledTime < new Date()) {
      throw new ValidationError('Cannot schedule appointments in the past');
    }

    // Check for conflicts
    const overlapping = await this.appointmentRepo.findOverlapping(
      request.scheduledTime,
      request.duration
    );

    if (overlapping.length > 0) {
      throw new SchedulingConflictError('Time slot conflict: appointment already exists at this time', {
        existingAppointments: overlapping.map(a => ({
          id: a.id,
          scheduledTime: a.scheduledTime,
          duration: a.duration
        }))
      });
    }

    try {
      // Create Google Meet link for video calls
      let meetLink: string | undefined;
      if (request.type === 'video_call') {
        meetLink = await this.createGoogleMeet(request.scheduledTime, request.duration, request.propertyAddress);
      }

      // Create appointment
      return await this.appointmentRepo.create({
        inquiryId: request.inquiryId,
        type: request.type,
        scheduledTime: request.scheduledTime,
        duration: request.duration,
        zoomLink: meetLink, // Keep field name for DB compatibility
        propertyAddress: request.propertyAddress,
        status: 'scheduled'
      });
    } catch (error) {
      if (error instanceof SchedulingConflictError || error instanceof ValidationError) {
        throw error;
      }
      throw new AvailabilityError('Failed to schedule appointment');
    }
  }

  /**
   * Create a Google Meet meeting
   */
  private async createGoogleMeet(scheduledTime: Date, duration: number, propertyAddress?: string): Promise<string> {
    if (!this.meetService) {
      logger.warn('Google Meet service not configured, using placeholder link');
      const meetingId = Math.random().toString(36).substring(7);
      return `https://meet.google.com/${meetingId}`;
    }

    try {
      const meeting = await this.meetService.createMeeting({
        summary: `Property Viewing - ${propertyAddress || 'Video Call'}`,
        startTime: scheduledTime,
        duration,
        description: 'Video call to discuss the property and answer questions',
      });

      logger.info('Google Meet created', { eventId: meeting.id, meetLink: meeting.meetLink });
      return meeting.meetLink;
    } catch (error: any) {
      logger.error('Failed to create Google Meet, using placeholder', { error: error.message });
      // Fallback to placeholder if Google Meet fails
      const meetingId = Math.random().toString(36).substring(7);
      return `https://meet.google.com/${meetingId}`;
    }
  }

  /**
   * Cancel an appointment
   */
  async cancelAppointment(appointmentId: string): Promise<Appointment> {
    const updated = await this.appointmentRepo.updateStatus(appointmentId, 'cancelled');
    if (!updated) {
      throw new Error('Appointment not found');
    }
    return updated;
  }

  /**
   * Get upcoming appointments for a manager
   */
  async getUpcomingAppointments(_managerId: string): Promise<Appointment[]> {
    // This would require joining with inquiries and properties tables
    // For now, returning empty array as placeholder
    // TODO: Implement proper query with joins
    return [];
  }

  // Helper methods

  private getDayName(date: Date): string {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
  }

  /**
   * Validate weekly schedule structure
   */
  private validateWeeklySchedule(schedule: WeeklySchedule): void {
    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    
    for (const [day, blocks] of Object.entries(schedule)) {
      if (!validDays.includes(day.toLowerCase())) {
        throw new ValidationError(`Invalid day name: ${day}`);
      }

      if (!Array.isArray(blocks)) {
        throw new ValidationError(`Time blocks for ${day} must be an array`);
      }

      for (const block of blocks) {
        if (!block.startTime || !block.endTime) {
          throw new ValidationError(`Time block missing startTime or endTime for ${day}`);
        }

        // Validate time format (HH:MM)
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(block.startTime) || !timeRegex.test(block.endTime)) {
          throw new ValidationError(`Invalid time format for ${day}. Use HH:MM format`);
        }

        // Validate start time is before end time
        const [startHour, startMin] = block.startTime.split(':').map(Number);
        const [endHour, endMin] = block.endTime.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;

        if (startMinutes >= endMinutes) {
          throw new ValidationError(`Start time must be before end time for ${day}`);
        }
      }
    }
  }

  /**
   * Validate blocked dates
   */
  private validateBlockedDates(blockedDates: DateRange[]): void {
    for (const range of blockedDates) {
      if (!range.startDate || !range.endDate) {
        throw new ValidationError('Blocked date range missing startDate or endDate');
      }

      const start = new Date(range.startDate);
      const end = new Date(range.endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new ValidationError('Invalid date format in blocked dates');
      }

      if (start > end) {
        throw new ValidationError('Blocked date range startDate must be before or equal to endDate');
      }
    }
  }

  private isDateBlocked(date: Date, blockedDates: DateRange[]): boolean {
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    for (const range of blockedDates) {
      const startDate = new Date(range.startDate);
      const endDate = new Date(range.endDate);
      const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
      
      if (dateOnly >= start && dateOnly <= end) {
        return true;
      }
    }
    
    return false;
  }

  private generateSlotsFromTimeBlock(date: Date, block: TimeBlock, slotDuration: number): TimeSlot[] {
    const slots: TimeSlot[] = [];
    
    // Parse start and end times
    const [startHour, startMinute] = block.startTime.split(':').map(Number);
    const [endHour, endMinute] = block.endTime.split(':').map(Number);
    
    const blockStart = new Date(date);
    blockStart.setHours(startHour, startMinute, 0, 0);
    
    const blockEnd = new Date(date);
    blockEnd.setHours(endHour, endMinute, 0, 0);
    
    // Generate slots
    let currentStart = new Date(blockStart);
    while (currentStart.getTime() + slotDuration * 60000 <= blockEnd.getTime()) {
      const currentEnd = new Date(currentStart.getTime() + slotDuration * 60000);
      slots.push({
        startTime: new Date(currentStart),
        endTime: currentEnd
      });
      currentStart = currentEnd;
    }
    
    return slots;
  }
}
