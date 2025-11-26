import { Pool } from 'pg';

export interface EmailTemplate {
  id: string;
  managerId: string;
  templateType: 'questionnaire' | 'qualified_scheduling' | 'disqualified_rejection' | 'appointment_confirmation';
  subject: string;
  htmlBody: string;
  plainTextBody: string;
  variables: string[];
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEmailTemplateParams {
  managerId: string;
  templateType: EmailTemplate['templateType'];
  subject: string;
  htmlBody: string;
  plainTextBody: string;
  variables?: string[];
  isDefault?: boolean;
}

export interface UpdateEmailTemplateParams {
  subject?: string;
  htmlBody?: string;
  plainTextBody?: string;
  variables?: string[];
  isDefault?: boolean;
}

export class EmailTemplateRepository {
  constructor(private pool: Pool) {}

  async create(params: CreateEmailTemplateParams): Promise<EmailTemplate> {
    const result = await this.pool.query(
      `INSERT INTO email_templates 
       (manager_id, template_type, subject, html_body, plain_text_body, variables, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, manager_id as "managerId", template_type as "templateType",
                 subject, html_body as "htmlBody", plain_text_body as "plainTextBody",
                 variables, is_default as "isDefault", created_at as "createdAt",
                 updated_at as "updatedAt"`,
      [
        params.managerId,
        params.templateType,
        params.subject,
        params.htmlBody,
        params.plainTextBody,
        JSON.stringify(params.variables || []),
        params.isDefault || false,
      ]
    );

    return result.rows[0];
  }


  async findById(id: string): Promise<EmailTemplate | null> {
    const result = await this.pool.query(
      `SELECT id, manager_id as "managerId", template_type as "templateType",
              subject, html_body as "htmlBody", plain_text_body as "plainTextBody",
              variables, is_default as "isDefault", created_at as "createdAt",
              updated_at as "updatedAt"
       FROM email_templates
       WHERE id = $1`,
      [id]
    );

    return result.rows[0] || null;
  }

  async findByManagerAndType(managerId: string, templateType: EmailTemplate['templateType']): Promise<EmailTemplate | null> {
    const result = await this.pool.query(
      `SELECT id, manager_id as "managerId", template_type as "templateType",
              subject, html_body as "htmlBody", plain_text_body as "plainTextBody",
              variables, is_default as "isDefault", created_at as "createdAt",
              updated_at as "updatedAt"
       FROM email_templates
       WHERE manager_id = $1 AND template_type = $2 AND is_default = TRUE
       LIMIT 1`,
      [managerId, templateType]
    );

    return result.rows[0] || null;
  }

  async findAllByManager(managerId: string): Promise<EmailTemplate[]> {
    const result = await this.pool.query(
      `SELECT id, manager_id as "managerId", template_type as "templateType",
              subject, html_body as "htmlBody", plain_text_body as "plainTextBody",
              variables, is_default as "isDefault", created_at as "createdAt",
              updated_at as "updatedAt"
       FROM email_templates
       WHERE manager_id = $1
       ORDER BY template_type, is_default DESC, created_at DESC`,
      [managerId]
    );

    return result.rows;
  }

  async update(id: string, params: UpdateEmailTemplateParams): Promise<EmailTemplate | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (params.subject !== undefined) {
      updates.push(`subject = $${paramIndex++}`);
      values.push(params.subject);
    }

    if (params.htmlBody !== undefined) {
      updates.push(`html_body = $${paramIndex++}`);
      values.push(params.htmlBody);
    }

    if (params.plainTextBody !== undefined) {
      updates.push(`plain_text_body = $${paramIndex++}`);
      values.push(params.plainTextBody);
    }

    if (params.variables !== undefined) {
      updates.push(`variables = $${paramIndex++}`);
      values.push(JSON.stringify(params.variables));
    }

    if (params.isDefault !== undefined) {
      updates.push(`is_default = $${paramIndex++}`);
      values.push(params.isDefault);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await this.pool.query(
      `UPDATE email_templates
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, manager_id as "managerId", template_type as "templateType",
                 subject, html_body as "htmlBody", plain_text_body as "plainTextBody",
                 variables, is_default as "isDefault", created_at as "createdAt",
                 updated_at as "updatedAt"`,
      values
    );

    return result.rows[0] || null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM email_templates WHERE id = $1`,
      [id]
    );

    return (result.rowCount || 0) > 0;
  }
}
