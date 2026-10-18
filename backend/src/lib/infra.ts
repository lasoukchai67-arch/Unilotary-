import pg from 'pg';
import { Redis } from 'ioredis';
import type { Config } from '../config.js';

// BIGINT ເປັນ string ໂດຍຄ່າເລີ່ມຕົ້ນ; ເງິນກີບບໍ່ເກີນ Number.MAX_SAFE_INTEGER ຈຶ່ງແປງເປັນ number
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));

export interface Deps {
  config: Config;
  db: pg.Pool;
  redis: Redis;
}

export type Db = pg.Pool | pg.PoolClient;

export function createInfra(config: Config): Pick<Deps, 'db' | 'redis'> {
  const db = new pg.Pool({ connectionString: config.DATABASE_URL, max: config.DB_POOL_SIZE });
  const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: 2 });
  return { db, redis };
}

export async function withTx<T>(db: pg.Pool, fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
