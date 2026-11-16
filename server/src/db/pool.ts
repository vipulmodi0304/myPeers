import pg from "pg";
import { logger } from "../logger.js";

/**
 * A thin layer over node-postgres. Every query is parameterized ($1, $2, ...)
 * so user input is never concatenated into SQL.
 */
export type Db = {
  query<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params?: unknown[]): Promise<T[]>;
  one<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params?: unknown[]): Promise<T | null>;
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
};

function wrap(client: pg.Pool | pg.PoolClient, pool: pg.Pool): Db {
  const db: Db = {
    async query(text, params = []) {
      const result = await client.query(text, params);
      return result.rows;
    },
    async one(text, params = []) {
      const rows = await db.query(text, params);
      return (rows[0] as never) ?? null;
    },
    async transaction(fn) {
      // Already inside a transaction: reuse the same connection.
      if (client !== pool) return fn(db);
      const conn = await pool.connect();
      try {
        await conn.query("begin");
        const result = await fn(wrap(conn, pool));
        await conn.query("commit");
        return result;
      } catch (err) {
        await conn.query("rollback");
        throw err;
      } finally {
        conn.release();
      }
    },
    async close() {
      await pool.end();
    },
  };
  return db;
}

export function createDb(connectionString: string): Db {
  const pool = new pg.Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 10_000,
    // A stuck query must not hold one of the 10 connections forever.
    statement_timeout: 15_000,
    // Railway's internal Postgres does not use TLS; external URLs usually do.
    ssl: /sslmode=require/.test(connectionString) ? { rejectUnauthorized: false } : undefined,
  });
  // Idle connections die when Postgres restarts. Without a listener that is an
  // uncaught 'error' event and takes the whole server down; the pool reconnects by itself.
  pool.on("error", (err) => logger.error({ err }, "Idle database connection failed"));
  return wrap(pool, pool);
}
