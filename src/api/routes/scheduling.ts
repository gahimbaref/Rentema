import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ValidationError, NotFoundError } from '../middleware/errorHandler';
import { SchedulingEngine } from '../../engines/SchedulingEngine';
import { AppointmentRepository } from '../../database/repositories/AppointmentRepository';
import { InquiryRepository } from '../../database/repositories/InquiryRepository';
import { PropertyRepository } from '../../database/repositories/PropertyRepository';
import { getDatabasePool } from '../../database/connection';
import { WeeklySchedule, DateRange, AppointmentType } from '../../models';

const router = Router();

// POST /availability - Set availability
router.post('/availability', async (req: AuthRequest, res: Response, next) => {
  try {
    const { scheduleType, recurringWeekly, blockedDates } = req.body;

    // Validation
    if (!scheduleType || !['video_call', 'tour'].includes(scheduleType)) {
      throw new ValidationError('Schedule type must be either "video_call" or "tour"');
    }

    if (!recurringWeekly || typeof recurringWeekly !== 'object') {
      throw new ValidationError('Recurring weekly schedule is required');
    }

    const pool = getDatabasePool();
    const schedulingEngine = new SchedulingEngine(pool);

    const schedule = await schedulingEngine.setAvailability(
      req.managerId!,
      scheduleType,
      recurringWeekly as WeeklySchedule,
      (blockedDates || []) as DateRange[]
    );

    res.status(201).json(schedule);
  } catch (error) {
    next(error);
  }
});

// GET /availability - Get availability
router.get('/availability', async (req: AuthRequest, res: Response, next) => {
  try {
    const { scheduleType } = req.query;

    if (!scheduleType || !['video_call', 'tour'].includes(scheduleType as string)) {
      throw new ValidationError('Schedule type query parameter must be either "video_call" or "tour"');
    }

    const pool = getDatabasePool();
    const schedulingEngine = new SchedulingEngine(pool);

    const schedule = await schedulingEngine.getAvailability(
      req.managerId!,
      scheduleType as 'video_call' | 'tour'
    );

    if (!schedule) {
      res.json({ message: 'No availability schedule found', schedule: null });
      return;
    }

    res.json(schedule);
  } catch (error) {
    next(error);
  }
});

// GET /availability/slots - Get available slots
router.get('/availability/slots', async (req: AuthRequest, res: Response, next) => {
  try {
    const { appointmentType, date, duration } = req.query;

    // Validation
    if (!appointmentType || !['video_call', 'tour'].includes(appointmentType as string)) {
      throw new ValidationError('Appointment type must be either "video_call" or "tour"');
    }

    if (!date) {
      throw new ValidationError('Date is required');
    }

    const slotDate = new Date(date as string);
    if (isNaN(slotDate.getTime())) {
      throw new ValidationError('Invalid date format');
    }

    const slotDuration = duration ? parseInt(duration as string) : 30;

    const pool = getDatabasePool();
    const schedulingEngine = new SchedulingEngine(pool);

    const slots = await schedulingEngine.getAvailableSlots(
      req.managerId!,
      appointmentType as AppointmentType,
      slotDate,
      slotDuration
    );

    res.json({ slots, count: slots.length });
  } catch (error) {
    next(error);
  }
});

// POST /appointments - Schedule appointment
router.post('/appointments', async (req: AuthRequest, res: Response, next) => {
  try {
    const { inquiryId, type, scheduledTime, duration, propertyAddress } = req.body;

    // Validation
    if (!inquiryId || typeof inquiryId !== 'string') {
      throw new ValidationError('Inquiry ID is required');
    }

    if (!type || !['video_call', 'tour'].includes(type)) {
      throw new ValidationError('Type must be either "video_call" or "tour"');
    }

    if (!scheduledTime) {
      throw new ValidationError('Scheduled time is required');
    }

    const appointmentTime = new Date(scheduledTime);
    if (isNaN(appointmentTime.getTime())) {
      throw new ValidationError('Invalid scheduled time format');
    }

    if (!duration || typeof duration !== 'number' || duration <= 0) {
      throw new ValidationError('Duration must be a positive number');
    }

    const pool = getDatabasePool();
    const inquiryRepo = new InquiryRepository(pool);
    const propertyRepo = new PropertyRepository(pool);

    // Verify inquiry exists and ownership
    const inquiry = await inquiryRepo.findById(inquiryId);
    if (!inquiry) {
      throw new NotFoundError('Inquiry not found');
    }

    const property = await propertyRepo.findById(inquiry.propertyId);
    if (!property || property.managerId !== req.managerId) {
      throw new NotFoundError('Inquiry not found');
    }

    const schedulingEngine = new SchedulingEngine(pool);

    const appointment = await schedulingEngine.scheduleAppointment({
      inquiryId,
      type: type as AppointmentType,
      scheduledTime: appointmentTime,
      duration,
      propertyAddress: propertyAddress || property.address,
    });

    res.status(201).json(appointment);
  } catch (error) {
    next(error);
  }
});

// DELETE /appointments/:id - Cancel appointment
router.delete('/appointments/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    const pool = getDatabasePool();
    const appointmentRepo = new AppointmentRepository(pool);
    const inquiryRepo = new InquiryRepository(pool);
    const propertyRepo = new PropertyRepository(pool);

    // Get appointment
    const appointment = await appointmentRepo.findById(id);
    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    // Verify ownership through inquiry -> property -> manager
    const inquiry = await inquiryRepo.findById(appointment.inquiryId);
    if (!inquiry) {
      throw new NotFoundError('Appointment not found');
    }

    const property = await propertyRepo.findById(inquiry.propertyId);
    if (!property || property.managerId !== req.managerId) {
      throw new NotFoundError('Appointment not found');
    }

    const schedulingEngine = new SchedulingEngine(pool);
    const cancelledAppointment = await schedulingEngine.cancelAppointment(id);

    res.json({
      message: 'Appointment cancelled successfully',
      appointment: cancelledAppointment,
    });
  } catch (error) {
    next(error);
  }
});

// GET /appointments - List appointments
router.get('/appointments', async (req: AuthRequest, res: Response, next) => {
  try {
    const { status, startDate, endDate } = req.query;

    const pool = getDatabasePool();
    const appointmentRepo = new AppointmentRepository(pool);
    const inquiryRepo = new InquiryRepository(pool);
    const propertyRepo = new PropertyRepository(pool);

    // Get all properties for this manager
    const properties = await propertyRepo.findByManagerId(req.managerId!);

    // Get all inquiries for these properties
    const allInquiries = [];
    for (const property of properties) {
      const inquiries = await inquiryRepo.findByPropertyId(property.id);
      allInquiries.push(...inquiries);
    }
    const inquiryIds = new Set(allInquiries.map(i => i.id));

    // Get all appointments for these inquiries
    let appointments = [];
    for (const inquiryId of inquiryIds) {
      const inquiryAppointments = await appointmentRepo.findByInquiryId(inquiryId);
      appointments.push(...inquiryAppointments);
    }

    // Apply status filter
    if (status) {
      appointments = appointments.filter(a => a.status === status);
    }

    // Apply date range filter
    if (startDate) {
      const start = new Date(startDate as string);
      appointments = appointments.filter(a => new Date(a.scheduledTime) >= start);
    }
    if (endDate) {
      const end = new Date(endDate as string);
      appointments = appointments.filter(a => new Date(a.scheduledTime) <= end);
    }

    res.json({ appointments, total: appointments.length });
  } catch (error) {
    next(error);
  }
});

export default router;
