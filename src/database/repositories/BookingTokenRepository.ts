import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

export interface BookingToken {
  id: string;
  inquiryId: string;
  token: string;
  slotStartTime: Date;
  slotEndTime: Date;
  appointmentType: 'video_call' | 'tour';
  isUsed: boolean;
  usedAt?: Date;
  expiresAt: Date;
  createdAt: Date;
}

export interface CreateBookingTokenParams {
  inquiryId: string;
  slotStartTime: Date;
  slotEndTime: Date;
  appointmentType: 'video_call' | 'tour';
  expiresInDays?: number;
}

export class BookingTokenRepository {
  constructor(private pool: Pool) {}

  async create(params: CreateBookingTokenParams): Promise<BookingToken> {
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (params.expiresInDays || 7));

    const result = await this.pool.query(
      `INSERT INTO booking_tokens 
       (inquiry_id, token, slot_start_time, slot_end_time, appointment_type, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, inquiry_id as "inquiryId", token, 
                 slot_start_time as "slotStartTime", slot_end_time as "slotEndTime",
                 appointment_type as "appointmentType", is_used as "isUsed",
                 used_at as "usedAt", expires_at as "expiresAt", created_at as "createdAt"`,
      [
        params.inquiryId,
        token,
        params.slotStartTime,
        params.slotEndTime,
        params.appointmentType,
        expiresAt,
      ]
    );

    return result.rows[0];
  }


  async findByToken(token: string): Promise<BookingToken | null> {
    const result = await this.pool.query(
      `SELECT id, inquiry_id as "inquiryId", token,
              slot_start_time as "slotStartTime", slot_end_time as "slotEndTime",
              appointment_type as "appointmentType", is_used as "isUsed",
              used_at as "usedAt", expires_at as "expiresAt", created_at as "createdAt"
       FROM booking_tokens
       WHERE token = $1`,
      [token]
    );

    return result.rows[0] || null;
  }

  async findByInquiryId(inquiryId: string): Promise<BookingToken[]> {
    const result = await this.pool.query(
      `SELECT id, inquiry_id as "inquiryId", token,
              slot_start_time as "slotStartTime", slot_end_time as "slotEndTime",
              appointment_type as "appointmentType", is_used as "isUsed",
              used_at as "usedAt", expires_at as "expiresAt", created_at as "createdAt"
       FROM booking_tokens
       WHERE inquiry_id = $1
       ORDER BY slot_start_time ASC`,
      [inquiryId]
    );

    return result.rows;
  }

  async markAsUsed(token: string): Promise<void> {
    await this.pool.query(
      `UPDATE booking_tokens
       SET is_used = TRUE, used_at = CURRENT_TIMESTAMP
       WHERE token = $1`,
      [token]
    );
  }

  async isValid(token: string): Promise<boolean> {
    const tokenData = await this.findByToken(token);
    
    if (!tokenData) {
      return false;
    }

    if (tokenData.isUsed) {
      return false;
    }

    if (new Date() > tokenData.expiresAt) {
      return false;
    }

    // Check if slot is in the past
    if (new Date() > tokenData.slotStartTime) {
      return false;
    }

    return true;
  }

  async deleteExpired(): Promise<number> {
    const result = await this.pool.query(
      `DELETE FROM booking_tokens
       WHERE expires_at < CURRENT_TIMESTAMP OR slot_start_time < CURRENT_TIMESTAMP`,
      []
    );

    return result.rowCount || 0;
  }
}
