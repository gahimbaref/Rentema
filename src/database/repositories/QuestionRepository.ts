import { Pool } from 'pg';
import { Question } from '../../models';

export class QuestionRepository {
  constructor(private pool: Pool) {}

  async create(question: Omit<Question, 'id' | 'createdAt'>): Promise<Question> {
    const result = await this.pool.query(
      `INSERT INTO questions (property_id, text, response_type, options, order_index, version)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, property_id as "propertyId", text, response_type as "responseType", options,
                 order_index as "order", version, created_at as "createdAt"`,
      [
        question.propertyId,
        question.text,
        question.responseType,
        question.options ? JSON.stringify(question.options) : null,
        question.order,
        question.version || 1
      ]
    );
    return result.rows[0];
  }

  async findById(id: string): Promise<Question | null> {
    const result = await this.pool.query(
      `SELECT id, property_id as "propertyId", text, response_type as "responseType", options,
              order_index as "order", version, created_at as "createdAt"
       FROM questions WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findByPropertyId(propertyId: string): Promise<Question[]> {
    const result = await this.pool.query(
      `SELECT id, property_id as "propertyId", text, response_type as "responseType", options,
              order_index as "order", version, created_at as "createdAt"
       FROM questions WHERE property_id = $1 ORDER BY order_index ASC`,
      [propertyId]
    );
    return result.rows;
  }

  async deleteByPropertyId(propertyId: string): Promise<void> {
    await this.pool.query('DELETE FROM questions WHERE property_id = $1', [propertyId]);
  }

  async delete(id: string): Promise<void> {
    await this.pool.query('DELETE FROM questions WHERE id = $1', [id]);
  }
}
