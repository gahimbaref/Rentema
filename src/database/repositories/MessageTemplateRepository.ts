import { Pool } from 'pg';
import { MessageTemplate, TemplateType } from '../../models/types';

export class MessageTemplateRepository {
  constructor(private pool: Pool) {}

  async save(template: Omit<MessageTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<MessageTemplate> {
    const query = `
      INSERT INTO message_templates (manager_id, template_type, content, required_variables, is_default)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (manager_id, template_type) 
      DO UPDATE SET 
        content = EXCLUDED.content,
        required_variables = EXCLUDED.required_variables,
        is_default = EXCLUDED.is_default,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    
    const result = await this.pool.query(query, [
      template.managerId,
      template.type,
      template.content,
      JSON.stringify(template.requiredVariables),
      template.isDefault
    ]);

    return this.mapRowToTemplate(result.rows[0]);
  }

  async findByManagerAndType(managerId: string, type: TemplateType): Promise<MessageTemplate | null> {
    const query = `
      SELECT * FROM message_templates
      WHERE manager_id = $1 AND template_type = $2
    `;
    
    const result = await this.pool.query(query, [managerId, type]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToTemplate(result.rows[0]);
  }

  async findDefaultByType(type: TemplateType): Promise<MessageTemplate | null> {
    const query = `
      SELECT * FROM message_templates
      WHERE template_type = $1 AND is_default = true
      LIMIT 1
    `;
    
    const result = await this.pool.query(query, [type]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToTemplate(result.rows[0]);
  }

  async deleteByManagerAndType(managerId: string, type: TemplateType): Promise<void> {
    const query = `
      DELETE FROM message_templates
      WHERE manager_id = $1 AND template_type = $2 AND is_default = false
    `;
    
    await this.pool.query(query, [managerId, type]);
  }

  private mapRowToTemplate(row: any): MessageTemplate {
    return {
      id: row.id,
      managerId: row.manager_id,
      type: row.template_type as TemplateType,
      content: row.content,
      requiredVariables: Array.isArray(row.required_variables) 
        ? row.required_variables 
        : JSON.parse(row.required_variables),
      isDefault: row.is_default,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}
