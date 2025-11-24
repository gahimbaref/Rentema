import { Pool, PoolClient } from 'pg';

export class Transaction {
  private client: PoolClient | null = null;

  constructor(private pool: Pool) {}

  async begin(): Promise<PoolClient> {
    this.client = await this.pool.connect();
    await this.client.query('BEGIN');
    return this.client;
  }

  async commit(): Promise<void> {
    if (!this.client) {
      throw new Error('Transaction not started');
    }
    await this.client.query('COMMIT');
    this.client.release();
    this.client = null;
  }

  async rollback(): Promise<void> {
    if (!this.client) {
      throw new Error('Transaction not started');
    }
    await this.client.query('ROLLBACK');
    this.client.release();
    this.client = null;
  }

  getClient(): PoolClient {
    if (!this.client) {
      throw new Error('Transaction not started');
    }
    return this.client;
  }
}

export async function withTransaction<T>(
  pool: Pool,
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const transaction = new Transaction(pool);
  try {
    const client = await transaction.begin();
    const result = await callback(client);
    await transaction.commit();
    return result;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
