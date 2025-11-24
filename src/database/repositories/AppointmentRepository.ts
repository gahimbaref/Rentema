import { Pool } from 'pg';
import { Appointment, AppointmentStatus } from '../../models';

export class AppointmentRepository {
  constructor(private pool: Pool) {}

  async create(appointment: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>): Promise<Appointment> {
    const result = await this.pool.query(
      `INSERT INTO appointments (inquiry_id, appointment_type, scheduled_time, duration, zoom_link, property_address, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, inquiry_id as "inquiryId", appointment_type as "type", scheduled_time as "scheduledTime",
                 duration, zoom_link as "zoomLink", property_address as "propertyAddress", status,
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [
        appointment.inquiryId,
        appointment.type,
        appointment.scheduledTime,
        appointment.duration,
        appointment.zoomLink || null,
        appointment.propertyAddress || null,
        appointment.status
      ]
    );
    return result.rows[0];
  }

  async findById(id: string): Promise<Appointment | null> {
    const result = await this.pool.query(
      `SELECT id, inquiry_id as "inquiryId", appointment_type as "type", scheduled_time as "scheduledTime",
              duration, zoom_link as "zoomLink", property_address as "propertyAddress", status,
              created_at as "createdAt", updated_at as "updatedAt"
       FROM appointments WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findByInquiryId(inquiryId: string): Promise<Appointment[]> {
    const result = await this.pool.query(
      `SELECT id, inquiry_id as "inquiryId", appointment_type as "type", scheduled_time as "scheduledTime",
              duration, zoom_link as "zoomLink", property_address as "propertyAddress", status,
              created_at as "createdAt", updated_at as "updatedAt"
       FROM appointments WHERE inquiry_id = $1 ORDER BY scheduled_time ASC`,
      [inquiryId]
    );
    return result.rows;
  }

  async findOverlapping(scheduledTime: Date, duration: number): Promise<Appointment[]> {
    const endTime = new Date(scheduledTime.getTime() + duration * 60000);
    
    const result = await this.pool.query(
      `SELECT id, inquiry_id as "inquiryId", appointment_type as "type", scheduled_time as "scheduledTime",
              duration, zoom_link as "zoomLink", property_address as "propertyAddress", status,
              created_at as "createdAt", updated_at as "updatedAt"
       FROM appointments 
       WHERE status = 'scheduled'
         AND scheduled_time < $2
         AND (scheduled_time + (duration || ' minutes')::interval) > $1`,
      [scheduledTime, endTime]
    );
    return result.rows;
  }

  async updateStatus(id: string, status: AppointmentStatus): Promise<Appointment | null> {
    const result = await this.pool.query(
      `UPDATE appointments SET status = $1
       WHERE id = $2
       RETURNING id, inquiry_id as "inquiryId", appointment_type as "type", scheduled_time as "scheduledTime",
                 duration, zoom_link as "zoomLink", property_address as "propertyAddress", status,
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [status, id]
    );
    return result.rows[0] || null;
  }
}
