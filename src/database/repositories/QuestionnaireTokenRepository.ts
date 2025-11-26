import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

export interface QuestionnaireToken {
  id: string;
  inquiryId: string;
  token: string;
  expiresAt: Date;
  isUsed: boolean;
  usedAt?: Date;
  createdAt: Date;
}

export class QuestionnaireTokenRepository {
  constructor(private pool: Pool) {}

  async create(inquiryId: string, expiresInDays: number = 7): Promise<QuestionnaireToken> {
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const result = await this.pool.query(
      `INSERT INTO questionnaire_tokens (inquiry_id, token, expires_at)
       VALUES ($1, $2, $3)
       RETURNING id, inquiry_id as "inquiryId", token, expires_at as "expiresAt", 
                 is_used as "isUsed", used_at as "usedAt", created_at as "createdAt"`,
      [inquiryId, token, expiresAt]
    );

    return result.rows[0];
  }

  async findByToken(token: string): Promise<QuestionnaireToken | null> {
    const result = await this.pool.query(
      `SELECT id, inquiry_id as "inquiryId", token, expires_at as "expiresAt",
              is_used as "isUsed", used_at as "usedAt", created_at as "createdAt"
       FROM questionnaire_tokens
       WHERE token = $1`,
      [token]
    );

    return result.rows[0] || null;
  }


  async findByInquiryId(inquiryId: string): Promise<QuestionnaireToken | null> {
    const result = await this.pool.query(
      `SELECT id, inquiry_id as "inquiryId", token, expires_at as "expiresAt",
              is_used as "isUsed", used_at as "usedAt", created_at as "createdAt"
       FROM questionnaire_tokens
       WHERE inquiry_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [inquiryId]
    );

    return result.rows[0] || null;
  }

  async markAsUsed(token: string): Promise<void> {
    await this.pool.query(
      `UPDATE questionnaire_tokens
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

    return true;
  }

  async deleteExpired(): Promise<number> {
    const result = await this.pool.query(
      `DELETE FROM questionnaire_tokens
       WHERE expires_at < CURRENT_TIMESTAMP`,
      []
    );

    return result.rowCount || 0;
  }
}
