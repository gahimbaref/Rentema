import { Pool } from 'pg';
import { Message, MessageStatus } from '../../models';

export class MessageRepository {
  constructor(private pool: Pool) {}

  async create(message: Omit<Message, 'id' | 'timestamp'>): Promise<Message> {
    const result = await this.pool.query(
      `INSERT INTO messages (inquiry_id, direction, content, status)
       VALUES ($1, $2, $3, $4)
       RETURNING id, inquiry_id as "inquiryId", direction, content, status, timestamp`,
      [message.inquiryId, message.direction, message.content, message.status]
    );
    return result.rows[0];
  }

  async findByInquiryId(inquiryId: string): Promise<Message[]> {
    const result = await this.pool.query(
      `SELECT id, inquiry_id as "inquiryId", direction, content, status, timestamp
       FROM messages WHERE inquiry_id = $1 ORDER BY timestamp ASC`,
      [inquiryId]
    );
    return result.rows;
  }

  async updateStatus(id: string, status: MessageStatus): Promise<Message | null> {
    const result = await this.pool.query(
      `UPDATE messages SET status = $1
       WHERE id = $2
       RETURNING id, inquiry_id as "inquiryId", direction, content, status, timestamp`,
      [status, id]
    );
    return result.rows[0] || null;
  }
}
