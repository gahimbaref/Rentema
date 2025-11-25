import { Pool } from 'pg';
import { AvailabilitySchedule, WeeklySchedule, DateRange } from '../../models';

export class AvailabilityScheduleRepository {
  constructor(private pool: Pool) {}

  async create(schedule: Omit<AvailabilitySchedule, 'id' | 'createdAt' | 'updatedAt'>): Promise<AvailabilitySchedule> {
    const result = await this.pool.query(
      `INSERT INTO availability_schedules (manager_id, schedule_type, recurring_weekly, blocked_dates)
       VALUES ($1, $2, $3, $4)
       RETURNING id, manager_id as "managerId", schedule_type as "scheduleType",
                 recurring_weekly as "recurringWeekly", blocked_dates as "blockedDates",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [
        schedule.managerId,
        schedule.scheduleType,
        JSON.stringify(schedule.recurringWeekly),
        JSON.stringify(schedule.blockedDates)
      ]
    );
    return result.rows[0];
  }

  async findByManagerAndType(managerId: string, scheduleType: 'video_call' | 'tour'): Promise<AvailabilitySchedule | null> {
    const result = await this.pool.query(
      `SELECT id, manager_id as "managerId", schedule_type as "scheduleType",
              recurring_weekly as "recurringWeekly", blocked_dates as "blockedDates",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM availability_schedules
       WHERE manager_id = $1 AND schedule_type = $2`,
      [managerId, scheduleType]
    );
    return result.rows[0] || null;
  }

  async update(id: string, recurringWeekly: WeeklySchedule, blockedDates: DateRange[]): Promise<AvailabilitySchedule | null> {
    const result = await this.pool.query(
      `UPDATE availability_schedules
       SET recurring_weekly = $1, blocked_dates = $2
       WHERE id = $3
       RETURNING id, manager_id as "managerId", schedule_type as "scheduleType",
                 recurring_weekly as "recurringWeekly", blocked_dates as "blockedDates",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [JSON.stringify(recurringWeekly), JSON.stringify(blockedDates), id]
    );
    return result.rows[0] || null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM availability_schedules WHERE id = $1`,
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }
}
