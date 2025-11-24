import { Pool } from 'pg';
import { Inquiry, InquiryStatus, QualificationResult } from '../../models';

export class InquiryRepository {
  constructor(private pool: Pool) {}

  async create(inquiry: Omit<Inquiry, 'id' | 'createdAt' | 'updatedAt'>): Promise<Inquiry> {
    const result = await this.pool.query(
      `INSERT INTO inquiries (property_id, platform_id, external_inquiry_id, prospective_tenant_id, 
                              prospective_tenant_name, status, qualification_result, question_snapshot)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, property_id as "propertyId", platform_id as "platformId", 
                 external_inquiry_id as "externalInquiryId", prospective_tenant_id as "prospectiveTenantId",
                 prospective_tenant_name as "prospectiveTenantName", status, 
                 qualification_result as "qualificationResult", question_snapshot as "questionSnapshot",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [
        inquiry.propertyId,
        inquiry.platformId,
        inquiry.externalInquiryId,
        inquiry.prospectiveTenantId,
        inquiry.prospectiveTenantName || null,
        inquiry.status,
        inquiry.qualificationResult ? JSON.stringify(inquiry.qualificationResult) : null,
        inquiry.questionSnapshot ? JSON.stringify(inquiry.questionSnapshot) : null
      ]
    );
    return result.rows[0];
  }

  async findById(id: string): Promise<Inquiry | null> {
    const result = await this.pool.query(
      `SELECT id, property_id as "propertyId", platform_id as "platformId",
              external_inquiry_id as "externalInquiryId", prospective_tenant_id as "prospectiveTenantId",
              prospective_tenant_name as "prospectiveTenantName", status,
              qualification_result as "qualificationResult", question_snapshot as "questionSnapshot",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM inquiries WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findByPropertyId(propertyId: string): Promise<Inquiry[]> {
    const result = await this.pool.query(
      `SELECT id, property_id as "propertyId", platform_id as "platformId",
              external_inquiry_id as "externalInquiryId", prospective_tenant_id as "prospectiveTenantId",
              prospective_tenant_name as "prospectiveTenantName", status,
              qualification_result as "qualificationResult", question_snapshot as "questionSnapshot",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM inquiries WHERE property_id = $1 ORDER BY created_at DESC`,
      [propertyId]
    );
    return result.rows;
  }

  async findByStatus(status: InquiryStatus): Promise<Inquiry[]> {
    const result = await this.pool.query(
      `SELECT id, property_id as "propertyId", platform_id as "platformId",
              external_inquiry_id as "externalInquiryId", prospective_tenant_id as "prospectiveTenantId",
              prospective_tenant_name as "prospectiveTenantName", status,
              qualification_result as "qualificationResult", question_snapshot as "questionSnapshot",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM inquiries WHERE status = $1 ORDER BY created_at DESC`,
      [status]
    );
    return result.rows;
  }

  async updateStatus(id: string, status: InquiryStatus): Promise<Inquiry | null> {
    const result = await this.pool.query(
      `UPDATE inquiries SET status = $1
       WHERE id = $2
       RETURNING id, property_id as "propertyId", platform_id as "platformId",
                 external_inquiry_id as "externalInquiryId", prospective_tenant_id as "prospectiveTenantId",
                 prospective_tenant_name as "prospectiveTenantName", status,
                 qualification_result as "qualificationResult", question_snapshot as "questionSnapshot",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [status, id]
    );
    return result.rows[0] || null;
  }

  async updateQualificationResult(id: string, result: QualificationResult): Promise<Inquiry | null> {
    const queryResult = await this.pool.query(
      `UPDATE inquiries SET qualification_result = $1
       WHERE id = $2
       RETURNING id, property_id as "propertyId", platform_id as "platformId",
                 external_inquiry_id as "externalInquiryId", prospective_tenant_id as "prospectiveTenantId",
                 prospective_tenant_name as "prospectiveTenantName", status,
                 qualification_result as "qualificationResult", question_snapshot as "questionSnapshot",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [JSON.stringify(result), id]
    );
    return queryResult.rows[0] || null;
  }

  async findByExternalId(externalId: string, platformId: string): Promise<Inquiry | null> {
    const result = await this.pool.query(
      `SELECT id, property_id as "propertyId", platform_id as "platformId",
              external_inquiry_id as "externalInquiryId", prospective_tenant_id as "prospectiveTenantId",
              prospective_tenant_name as "prospectiveTenantName", status,
              qualification_result as "qualificationResult", question_snapshot as "questionSnapshot",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM inquiries WHERE external_inquiry_id = $1 AND platform_id = $2`,
      [externalId, platformId]
    );
    return result.rows[0] || null;
  }
}
