import type { PostgresClient } from "@mvfm/plugin-postgres";

interface PgLiteQueryable {
  query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  transaction<T>(fn: (tx: PgLiteQueryable) => Promise<T>): Promise<T>;
}

/**
 * Wraps a PGLite instance (or transaction) as a {@link PostgresClient}.
 *
 * Savepoints use manual SQL since PGLite's Transaction interface
 * doesn't expose a savepoint API. Cursors fetch all rows and
 * slice into batches (fine for docs, not production).
 */
export function wrapPgLite(db: PgLiteQueryable): PostgresClient {
  let savepointCounter = 0;
  return {
    async query(sql: string, params: unknown[]): Promise<unknown[]> {
      const result = await db.query(sql, params);
      return result.rows;
    },

    async begin<T>(fn: (tx: PostgresClient) => Promise<T>): Promise<T> {
      return db.transaction(async (tx) => {
        return fn(wrapPgLite(tx));
      });
    },

    async savepoint<T>(fn: (tx: PostgresClient) => Promise<T>): Promise<T> {
      const name = `sp_${++savepointCounter}`;
      await db.query(`SAVEPOINT ${name}`);
      try {
        const result = await fn(wrapPgLite(db));
        await db.query(`RELEASE SAVEPOINT ${name}`);
        return result;
      } catch (e) {
        await db.query(`ROLLBACK TO SAVEPOINT ${name}`);
        throw e;
      }
    },

    async cursor(
      sql: string,
      params: unknown[],
      batchSize: number,
      fn: (rows: unknown[]) => Promise<undefined | false>,
    ): Promise<void> {
      const result = await db.query(sql, params);
      const allRows = result.rows as unknown[];
      for (let i = 0; i < allRows.length; i += batchSize) {
        const batch = allRows.slice(i, i + batchSize);
        const signal = await fn(batch);
        if (signal === false) break;
      }
    },
  };
}
