import { Pool } from 'pg';
import { QualificationCriteria } from '../../models';

export class QualificationCriteriaRepository {
  constructor(private pool: Pool) {}

  async create(criteria: Omit<QualificationCriteria, 'id' | 'createdAt'>): Promise<QualificationCriteria> {
    const result = await this.pool.query(
      `INSERT INTO qualification_criteria (property_id, question_id, operator, expected_value)
       VALUES ($1, $2, $3, $4)
       RETURNING id, property_id as "propertyId", question_id as "questionId", operator, 
                 expected_value as "expectedValue", created_at as "createdAt"`,
      [
        criteria.propertyId,
        criteria.questionId,
        criteria.operator,
        JSON.stringify(criteria.expectedValue)
      ]
    );
    return result.rows[0];
  }

  async findByPropertyId(propertyId: string): Promise<QualificationCriteria[]> {
    const result = await this.pool.query(
      `SELECT id, property_id as "propertyId", question_id as "questionId", operator,
              expected_value as "expectedValue", created_at as "createdAt"
       FROM qualification_criteria WHERE property_id = $1`,
      [propertyId]
    );
    return result.rows;
  }

  async findByQuestionId(questionId: string): Promise<QualificationCriteria[]> {
    const result = await this.pool.query(
      `SELECT id, property_id as "propertyId", question_id as "questionId", operator,
              expected_value as "expectedValue", created_at as "createdAt"
       FROM qualification_criteria WHERE question_id = $1`,
      [questionId]
    );
    return result.rows;
  }

  async deleteByPropertyId(propertyId: string): Promise<void> {
    await this.pool.query('DELETE FROM qualification_criteria WHERE property_id = $1', [propertyId]);
  }

  async delete(id: string): Promise<void> {
    await this.pool.query('DELETE FROM qualification_criteria WHERE id = $1', [id]);
  }
}
