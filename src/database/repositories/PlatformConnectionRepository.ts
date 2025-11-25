import { Pool } from 'pg';
import { PlatformConnection } from '../../models';
import { encryptCredentials, decryptCredentials } from '../encryption';

export class PlatformConnectionRepository {
  constructor(private pool: Pool) {}

  async create(connection: Omit<PlatformConnection, 'id' | 'createdAt' | 'updatedAt'>): Promise<PlatformConnection> {
    const encryptedCredentials = encryptCredentials(connection.credentials);
    
    const result = await this.pool.query(
      `INSERT INTO platform_connections (manager_id, platform_type, credentials, is_active, last_verified)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, manager_id as "managerId", platform_type as "platformType", credentials,
                 is_active as "isActive", last_verified as "lastVerified",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [
        connection.managerId,
        connection.platformType,
        JSON.stringify({ encrypted: encryptedCredentials }),
        connection.isActive,
        connection.lastVerified || null
      ]
    );
    
    const row = result.rows[0];
    row.credentials = decryptCredentials(row.credentials.encrypted);
    return row;
  }

  async findById(id: string): Promise<PlatformConnection | null> {
    const result = await this.pool.query(
      `SELECT id, manager_id as "managerId", platform_type as "platformType", credentials,
              is_active as "isActive", last_verified as "lastVerified",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM platform_connections WHERE id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    row.credentials = row.credentials?.encrypted ? decryptCredentials(row.credentials.encrypted) : {};
    return row;
  }

  async findByManagerId(managerId: string): Promise<PlatformConnection[]> {
    const result = await this.pool.query(
      `SELECT id, manager_id as "managerId", platform_type as "platformType", credentials,
              is_active as "isActive", last_verified as "lastVerified",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM platform_connections WHERE manager_id = $1 ORDER BY created_at DESC`,
      [managerId]
    );
    
    return result.rows.map(row => ({
      ...row,
      credentials: row.credentials?.encrypted ? decryptCredentials(row.credentials.encrypted) : {}
    }));
  }

  async updateVerificationStatus(id: string, lastVerified: Date): Promise<PlatformConnection | null> {
    const result = await this.pool.query(
      `UPDATE platform_connections SET last_verified = $1
       WHERE id = $2
       RETURNING id, manager_id as "managerId", platform_type as "platformType", credentials,
                 is_active as "isActive", last_verified as "lastVerified",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [lastVerified, id]
    );
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    row.credentials = row.credentials?.encrypted ? decryptCredentials(row.credentials.encrypted) : {};
    return row;
  }

  async updateActiveStatus(id: string, isActive: boolean): Promise<PlatformConnection | null> {
    const result = await this.pool.query(
      `UPDATE platform_connections SET is_active = $1
       WHERE id = $2
       RETURNING id, manager_id as "managerId", platform_type as "platformType", credentials,
                 is_active as "isActive", last_verified as "lastVerified",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [isActive, id]
    );
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    row.credentials = row.credentials?.encrypted ? decryptCredentials(row.credentials.encrypted) : {};
    return row;
  }

  async delete(id: string): Promise<void> {
    await this.pool.query('DELETE FROM platform_connections WHERE id = $1', [id]);
  }
}
