import type postgres from "postgres";
import type { PostgresClient } from "./interpreter";

type Sql = postgres.Sql;
type TransactionSql = postgres.TransactionSql;

export function wrapPostgresJs(sql: Sql | TransactionSql): PostgresClient {
  return {
    async query(sqlStr: string, params: unknown[]): Promise<unknown[]> {
      // Use sql.unsafe() to execute pre-built parameterized SQL.
      // The interpreter has already constructed the parameterized SQL with
      // $1, $2 placeholders — we don't want postgres.js to re-parameterize.
      const result = await sql.unsafe(sqlStr, params as any[]);
      return Array.from(result);
    },

    async begin<T>(fn: (tx: PostgresClient) => Promise<T>): Promise<T> {
      return (sql as Sql).begin(async (txSql) => {
        return fn(wrapPostgresJs(txSql));
      }) as Promise<T>;
    },

    async savepoint<T>(fn: (tx: PostgresClient) => Promise<T>): Promise<T> {
      return (sql as TransactionSql).savepoint(async (spSql) => {
        return fn(wrapPostgresJs(spSql));
      }) as Promise<T>;
    },

    async cursor(
      sqlStr: string,
      params: unknown[],
      batchSize: number,
      fn: (rows: unknown[]) => Promise<undefined | false>,
    ): Promise<void> {
      await sql.unsafe(sqlStr, params as any[]).cursor(batchSize, async (rows: any[]) => {
        const result = await fn(rows);
        if (result === false) return (sql as Sql).CLOSE;
      });
    },
  };
}
