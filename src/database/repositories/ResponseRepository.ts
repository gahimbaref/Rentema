import { Pool } from 'pg';
import { Response } from '../../models';

export class ResponseRepository {
  constructor(private pool: Pool) {}

  async create(response: Omit<Response, 'id' | 'timestamp'>): Promise<Response> {
    const result = await this.pool.query(
      `INSERT INTO responses (inquiry_id, question_id, value)
       VALUES ($1, $2, $3)
       RETURNING id, inquiry_id as "inquiryId", question_id as "questionId", value, timestamp`,
      [response.inquiryId, response.questionId, JSON.stringify(response.value)]
    );
    return result.rows[0];
  }

  async findByInquiryId(inquiryId: string): Promise<Response[]> {
    const result = await this.pool.query(
      `SELECT id, inquiry_id as "inquiryId", question_id as "questionId", value, timestamp
       FROM responses WHERE inquiry_id = $1 ORDER BY timestamp ASC`,
      [inquiryId]
    );
    return result.rows;
  }

  async findByQuestionId(questionId: string): Promise<Response[]> {
    const result = await this.pool.query(
      `SELECT id, inquiry_id as "inquiryId", question_id as "questionId", value, timestamp
       FROM responses WHERE question_id = $1 ORDER BY timestamp ASC`,
      [questionId]
    );
    return result.rows;
  }
}
