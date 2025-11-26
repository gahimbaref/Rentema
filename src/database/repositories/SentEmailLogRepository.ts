import { Pool } from 'pg';

export interface SentEmailLog {
  id: string;
  inquiryId: string;
  connectionId?: string;
  emailType: 'questionnaire' | 'qualified_scheduling' | 'disqualified_rejection' | 'appointment_confirmation';
  toAddress: string;
  subject: string;
  gmailMessageId?: string;
  status: 'sent' | 'failed';
  error?: string;
  sentAt: Date;
}

export interface CreateSentEmailLogParams {
  inquiryId: string;
  connectionId?: string;
  emailType: SentEmailLog['emailType'];
  toAddress: string;
  subject: string;
  gmailMessageId?: string;
  status: 'sent' | 'failed';
  error?: string;
}

export class SentEmailLogRepository {
  constructor(private pool: Pool) {}

  async create(params: CreateSentEmailLogParams): Promise<SentEmailLog> {
    const result = await this.pool.query(
      `INSERT INTO sent_email_logs 
       (inquiry_id, connection_id, email_type, to_address, subject, gmail_message_id, status, error)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, inquiry_id as "inquiryId", connection_id as "connectionId",
                 email_type as "emailType", to_address as "toAddress", subject,
                 gmail_message_id as "gmailMessageId", status, error, sent_at as "sentAt"`,
      [
        params.inquiryId,
        params.connectionId || null,
        params.emailType,
        params.toAddress,
        params.subject,
        params.gmailMessageId || null,
        params.status,
        params.error || null,
      ]
    );

    return result.rows[0];
  }


  async findByInquiryId(inquiryId: string): Promise<SentEmailLog[]> {
    const result = await this.pool.query(
      `SELECT id, inquiry_id as "inquiryId", connection_id as "connectionId",
              email_type as "emailType", to_address as "toAddress", subject,
              gmail_message_id as "gmailMessageId", status, error, sent_at as "sentAt"
       FROM sent_email_logs
       WHERE inquiry_id = $1
       ORDER BY sent_at DESC`,
      [inquiryId]
    );

    return result.rows;
  }

  async findByType(inquiryId: string, emailType: SentEmailLog['emailType']): Promise<SentEmailLog | null> {
    const result = await this.pool.query(
      `SELECT id, inquiry_id as "inquiryId", connection_id as "connectionId",
              email_type as "emailType", to_address as "toAddress", subject,
              gmail_message_id as "gmailMessageId", status, error, sent_at as "sentAt"
       FROM sent_email_logs
       WHERE inquiry_id = $1 AND email_type = $2
       ORDER BY sent_at DESC
       LIMIT 1`,
      [inquiryId, emailType]
    );

    return result.rows[0] || null;
  }

  async getRecentLogs(limit: number = 50): Promise<SentEmailLog[]> {
    const result = await this.pool.query(
      `SELECT id, inquiry_id as "inquiryId", connection_id as "connectionId",
              email_type as "emailType", to_address as "toAddress", subject,
              gmail_message_id as "gmailMessageId", status, error, sent_at as "sentAt"
       FROM sent_email_logs
       ORDER BY sent_at DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows;
  }
}
