import { Pool } from 'pg';
import { InquiryNote } from '../../models';

export class InquiryNoteRepository {
  constructor(private pool: Pool) {}

  async create(note: Omit<InquiryNote, 'id' | 'createdAt'>): Promise<InquiryNote> {
    const result = await this.pool.query(
      `INSERT INTO inquiry_notes (inquiry_id, note, created_by)
       VALUES ($1, $2, $3)
       RETURNING id, inquiry_id as "inquiryId", note, created_by as "createdBy", created_at as "createdAt"`,
      [note.inquiryId, note.note, note.createdBy]
    );
    return result.rows[0];
  }

  async findByInquiryId(inquiryId: string): Promise<InquiryNote[]> {
    const result = await this.pool.query(
      `SELECT id, inquiry_id as "inquiryId", note, created_by as "createdBy", created_at as "createdAt"
       FROM inquiry_notes WHERE inquiry_id = $1 ORDER BY created_at DESC`,
      [inquiryId]
    );
    return result.rows;
  }
}
