import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { SchedulingLinkGenerator } from '../../engines/SchedulingLinkGenerator';
import { InquiryRepository } from '../../database/repositories/InquiryRepository';
import { PropertyRepository } from '../../database/repositories/PropertyRepository';
import { logger } from '../../utils/logger';

export function createPublicBookingRouter(pool: Pool): Router {
  const router = Router();
  const schedulingLinkGen = new SchedulingLinkGenerator(pool);
  const inquiryRepo = new InquiryRepository(pool);
  const propertyRepo = new PropertyRepository(pool);

  // GET /public/booking/:token
  // Load booking details for a given token
  router.get('/:token', async (req: Request, res: Response) => {
    try {
      const { token } = req.params;

      // Validate token
      const validation = await schedulingLinkGen.validateBookingLink(token);

      if (!validation.isValid) {
        return res.status(400).json({
          error: 'Invalid or expired booking link',
          code: validation.error,
        });
      }

      // Get slot info
      const slotInfo = validation.slotInfo!;

      res.json({
        slotInfo: {
          startTime: slotInfo.startTime,
          endTime: slotInfo.endTime,
          appointmentType: slotInfo.appointmentType,
          date: slotInfo.startTime.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          }),
          time: slotInfo.startTime.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          }),
          duration: Math.round((slotInfo.endTime.getTime() - slotInfo.startTime.getTime()) / 60000),
        },
      });
    } catch (error: any) {
      logger.error('Error loading booking details', { error: error.message, token: req.params.token });
      res.status(500).json({ error: 'Failed to load booking details' });
    }
  });

  // POST /public/booking/:token/confirm
  // Confirm and book the appointment
  router.post('/:token/confirm', async (req: Request, res: Response) => {
    try {
      const { token } = req.params;

      // Book the appointment
      const appointmentId = await schedulingLinkGen.bookAppointment(token);

      logger.info('Appointment confirmed via public booking', { appointmentId, token });

      res.json({
        success: true,
        appointmentId,
        message: 'Your appointment has been confirmed!',
      });
    } catch (error: any) {
      logger.error('Error confirming booking', { error: error.message, token: req.params.token });
      
      if (error.message.includes('Invalid booking link')) {
        return res.status(400).json({ error: error.message });
      }

      res.status(500).json({ error: 'Failed to confirm booking' });
    }
  });

  return router;
}
