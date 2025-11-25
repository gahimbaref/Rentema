import { Pool, PoolConfig } from 'pg';
import { createClient, RedisClientType } from 'redis';

// PostgreSQL connection pool
let pgPool: Pool | null = null;

export function createDatabasePool(): Pool {
  if (pgPool) {
    return pgPool;
  }

  const config: PoolConfig = {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME || 'rentema',
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  };

  pgPool = new Pool(config);

  pgPool.on('error', (err) => {
    console.error('Unexpected database error:', err);
  });

  return pgPool;
}

export function getDatabasePool(): Pool {
  if (!pgPool) {
    return createDatabasePool();
  }
  return pgPool;
}

// Alias for backward compatibility
export const getPool = getDatabasePool;

export async function closeDatabasePool(): Promise<void> {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }
}

// Redis connection
let redisClient: RedisClientType | null = null;

export async function createRedisClient(): Promise<RedisClientType> {
  if (redisClient) {
    return redisClient;
  }

  const client = createClient({
    socket: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    },
  });

  client.on('error', (err) => {
    console.error('Redis error:', err);
  });

  await client.connect();
  redisClient = client as RedisClientType;

  return redisClient;
}

export function getRedisClient(): RedisClientType {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call createRedisClient() first.');
  }
  return redisClient;
}

export async function closeRedisClient(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
