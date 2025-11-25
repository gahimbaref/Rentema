import { Pool } from 'pg';

export interface PlatformPattern {
  id: string;
  platformType: string;
  senderPattern: string;
  subjectPattern?: string;
  bodyPatterns?: Record<string, string>;
  priority: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class PlatformPatternRepository {
  constructor(private pool: Pool) {}

  async create(pattern: Omit<PlatformPattern, 'id' | 'createdAt' | 'updatedAt'>): Promise<PlatformPattern> {
    const result = await this.pool.query(
      `INSERT INTO platform_patterns (platform_type, sender_pattern, subject_pattern, body_patterns, priority, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, platform_type as "platformType", sender_pattern as "senderPattern",
                 subject_pattern as "subjectPattern", body_patterns as "bodyPatterns",
                 priority, is_active as "isActive",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [
        pattern.platformType,
        pattern.senderPattern,
        pattern.subjectPattern || null,
        pattern.bodyPatterns ? JSON.stringify(pattern.bodyPatterns) : null,
        pattern.priority,
        pattern.isActive
      ]
    );
    
    return result.rows[0];
  }

  async findById(id: string): Promise<PlatformPattern | null> {
    const result = await this.pool.query(
      `SELECT id, platform_type as "platformType", sender_pattern as "senderPattern",
              subject_pattern as "subjectPattern", body_patterns as "bodyPatterns",
              priority, is_active as "isActive",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM platform_patterns WHERE id = $1`,
      [id]
    );
    
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async findAll(): Promise<PlatformPattern[]> {
    const result = await this.pool.query(
      `SELECT id, platform_type as "platformType", sender_pattern as "senderPattern",
              subject_pattern as "subjectPattern", body_patterns as "bodyPatterns",
              priority, is_active as "isActive",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM platform_patterns
       WHERE is_active = true
       ORDER BY priority DESC, created_at ASC`
    );
    
    return result.rows;
  }

  async update(id: string, pattern: Partial<Omit<PlatformPattern, 'id' | 'createdAt' | 'updatedAt'>>): Promise<PlatformPattern | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (pattern.platformType !== undefined) {
      fields.push(`platform_type = $${paramIndex++}`);
      values.push(pattern.platformType);
    }
    if (pattern.senderPattern !== undefined) {
      fields.push(`sender_pattern = $${paramIndex++}`);
      values.push(pattern.senderPattern);
    }
    if (pattern.subjectPattern !== undefined) {
      fields.push(`subject_pattern = $${paramIndex++}`);
      values.push(pattern.subjectPattern);
    }
    if (pattern.bodyPatterns !== undefined) {
      fields.push(`body_patterns = $${paramIndex++}`);
      values.push(JSON.stringify(pattern.bodyPatterns));
    }
    if (pattern.priority !== undefined) {
      fields.push(`priority = $${paramIndex++}`);
      values.push(pattern.priority);
    }
    if (pattern.isActive !== undefined) {
      fields.push(`is_active = $${paramIndex++}`);
      values.push(pattern.isActive);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const result = await this.pool.query(
      `UPDATE platform_patterns SET ${fields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, platform_type as "platformType", sender_pattern as "senderPattern",
                 subject_pattern as "subjectPattern", body_patterns as "bodyPatterns",
                 priority, is_active as "isActive",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      values
    );
    
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async delete(id: string): Promise<void> {
    await this.pool.query('DELETE FROM platform_patterns WHERE id = $1', [id]);
  }
}
