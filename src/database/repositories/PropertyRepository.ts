import { Pool } from 'pg';
import { Property } from '../../models';

export class PropertyRepository {
  constructor(private pool: Pool) {}

  async create(property: Omit<Property, 'id' | 'createdAt' | 'updatedAt'>): Promise<Property> {
    // Format date as YYYY-MM-DD to avoid timezone issues
    const availabilityDateStr = property.availabilityDate.toISOString().split('T')[0];
    
    const result = await this.pool.query(
      `INSERT INTO properties (manager_id, address, rent_amount, bedrooms, bathrooms, availability_date, is_test_mode, is_archived)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, manager_id as "managerId", address, rent_amount as "rentAmount", bedrooms, bathrooms, 
                 to_char(availability_date, 'YYYY-MM-DD') as "availabilityDate", is_test_mode as "isTestMode", is_archived as "isArchived",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [
        property.managerId,
        property.address,
        property.rentAmount,
        property.bedrooms,
        property.bathrooms,
        availabilityDateStr,
        property.isTestMode,
        property.isArchived
      ]
    );
    const row = result.rows[0];
    return {
      ...row,
      rentAmount: parseFloat(row.rentAmount),
      bathrooms: parseFloat(row.bathrooms),
      availabilityDate: new Date(row.availabilityDate + 'T00:00:00Z')
    };
  }

  async findById(id: string): Promise<Property | null> {
    const result = await this.pool.query(
      `SELECT id, manager_id as "managerId", address, rent_amount as "rentAmount", bedrooms, bathrooms,
              to_char(availability_date, 'YYYY-MM-DD') as "availabilityDate", is_test_mode as "isTestMode", is_archived as "isArchived",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM properties WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return {
      ...row,
      rentAmount: parseFloat(row.rentAmount),
      bathrooms: parseFloat(row.bathrooms),
      availabilityDate: new Date(row.availabilityDate + 'T00:00:00Z')
    };
  }

  async findByManagerId(managerId: string): Promise<Property[]> {
    const result = await this.pool.query(
      `SELECT id, manager_id as "managerId", address, rent_amount as "rentAmount", bedrooms, bathrooms,
              to_char(availability_date, 'YYYY-MM-DD') as "availabilityDate", is_test_mode as "isTestMode", is_archived as "isArchived",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM properties WHERE manager_id = $1 ORDER BY created_at DESC`,
      [managerId]
    );
    return result.rows.map(row => ({
      ...row,
      rentAmount: parseFloat(row.rentAmount),
      bathrooms: parseFloat(row.bathrooms),
      availabilityDate: new Date(row.availabilityDate + 'T00:00:00Z')
    }));
  }

  async update(id: string, updates: Partial<Omit<Property, 'id' | 'managerId' | 'createdAt' | 'updatedAt'>>): Promise<Property | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.address !== undefined) {
      fields.push(`address = $${paramIndex++}`);
      values.push(updates.address);
    }
    if (updates.rentAmount !== undefined) {
      fields.push(`rent_amount = $${paramIndex++}`);
      values.push(updates.rentAmount);
    }
    if (updates.bedrooms !== undefined) {
      fields.push(`bedrooms = $${paramIndex++}`);
      values.push(updates.bedrooms);
    }
    if (updates.bathrooms !== undefined) {
      fields.push(`bathrooms = $${paramIndex++}`);
      values.push(updates.bathrooms);
    }
    if (updates.availabilityDate !== undefined) {
      fields.push(`availability_date = $${paramIndex++}`);
      // Format date as YYYY-MM-DD to avoid timezone issues
      values.push(updates.availabilityDate.toISOString().split('T')[0]);
    }
    if (updates.isTestMode !== undefined) {
      fields.push(`is_test_mode = $${paramIndex++}`);
      values.push(updates.isTestMode);
    }
    if (updates.isArchived !== undefined) {
      fields.push(`is_archived = $${paramIndex++}`);
      values.push(updates.isArchived);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const result = await this.pool.query(
      `UPDATE properties SET ${fields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, manager_id as "managerId", address, rent_amount as "rentAmount", bedrooms, bathrooms,
                 to_char(availability_date, 'YYYY-MM-DD') as "availabilityDate", is_test_mode as "isTestMode", is_archived as "isArchived",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      values
    );
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return {
      ...row,
      rentAmount: parseFloat(row.rentAmount),
      bathrooms: parseFloat(row.bathrooms),
      availabilityDate: new Date(row.availabilityDate + 'T00:00:00Z')
    };
  }

  async archive(id: string): Promise<Property | null> {
    return this.update(id, { isArchived: true });
  }

  async delete(id: string): Promise<void> {
    await this.pool.query('DELETE FROM properties WHERE id = $1', [id]);
  }
}
