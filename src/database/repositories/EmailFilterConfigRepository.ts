import { Pool } from 'pg';

export interface EmailFilterConfig {
  id: string;
  connectionId: string;
  senderWhitelist: string[];
  subjectKeywords: string[];
  excludeSenders: string[];
  excludeSubjectKeywords: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class EmailFilterConfigRepository {
  constructor(private pool: Pool) {}

  async create(config: Omit<EmailFilterConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<EmailFilterConfig> {
    const result = await this.pool.query(
      `INSERT INTO email_filter_configs 
       (connection_id, sender_whitelist, subject_keywords, exclude_senders, exclude_subject_keywords)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        config.connectionId,
        JSON.stringify(config.senderWhitelist),
        JSON.stringify(config.subjectKeywords),
        JSON.stringify(config.excludeSenders),
        JSON.stringify(config.excludeSubjectKeywords)
      ]
    );
    return this.mapRow(result.rows[0]);
  }

  async findByConnectionId(connectionId: string): Promise<EmailFilterConfig | null> {
    const result = await this.pool.query(
      'SELECT * FROM email_filter_configs WHERE connection_id = $1',
      [connectionId]
    );
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  async update(connectionId: string, config: Partial<Omit<EmailFilterConfig, 'id' | 'connectionId' | 'createdAt' | 'updatedAt'>>): Promise<EmailFilterConfig> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (config.senderWhitelist !== undefined) {
      updates.push(`sender_whitelist = $${paramIndex++}`);
      values.push(JSON.stringify(config.senderWhitelist));
    }
    if (config.subjectKeywords !== undefined) {
      updates.push(`subject_keywords = $${paramIndex++}`);
      values.push(JSON.stringify(config.subjectKeywords));
    }
    if (config.excludeSenders !== undefined) {
      updates.push(`exclude_senders = $${paramIndex++}`);
      values.push(JSON.stringify(config.excludeSenders));
    }
    if (config.excludeSubjectKeywords !== undefined) {
      updates.push(`exclude_subject_keywords = $${paramIndex++}`);
      values.push(JSON.stringify(config.excludeSubjectKeywords));
    }

    values.push(connectionId);

    const result = await this.pool.query(
      `UPDATE email_filter_configs 
       SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE connection_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('Email filter config not found');
    }

    return this.mapRow(result.rows[0]);
  }

  async delete(connectionId: string): Promise<void> {
    await this.pool.query(
      'DELETE FROM email_filter_configs WHERE connection_id = $1',
      [connectionId]
    );
  }

  private mapRow(row: any): EmailFilterConfig {
    return {
      id: row.id,
      connectionId: row.connection_id,
      senderWhitelist: row.sender_whitelist || [],
      subjectKeywords: row.subject_keywords || [],
      excludeSenders: row.exclude_senders || [],
      excludeSubjectKeywords: row.exclude_subject_keywords || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
