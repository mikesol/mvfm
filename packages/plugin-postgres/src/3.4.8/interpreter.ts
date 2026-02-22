import type { Interpreter, RuntimeEntry } from "@mvfm/core";

/**
 * Database client interface consumed by the postgres handler.
 *
 * Abstracts over the actual database driver so handlers can be
 * tested with mock clients.
 */
export interface PostgresClient {
  query(sql: string, params: unknown[]): Promise<unknown[]>;
  begin<T>(fn: (tx: PostgresClient) => Promise<T>): Promise<T>;
  savepoint<T>(fn: (tx: PostgresClient) => Promise<T>): Promise<T>;
  cursor(
    sql: string,
    params: unknown[],
    batchSize: number,
    fn: (rows: unknown[]) => Promise<undefined | false>,
  ): Promise<void>;
}

/** Escape identifier -- matches postgres.js src/types.js:216 */
export function escapeIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""').replace(/\./g, '"."')}"`;
}

/** Marker for SQL fragment results from identifier/insert/set helpers. */
interface PgFragment {
  __pgFragment: true;
  sql: string;
  params: unknown[];
}

function isPgFragment(v: unknown): v is PgFragment {
  return typeof v === "object" && v !== null && (v as PgFragment).__pgFragment === true;
}

/**
 * Build parameterized SQL from a postgres/query RuntimeEntry.
 *
 * Children layout: [numStrings, ...stringParts, ...paramValues]
 * Each paramValue is either a primitive, or a PgFragment from
 * identifier/insert_helper/set_helper handlers.
 */
function buildQuerySQL(
  strings: string[],
  paramValues: unknown[],
): { sql: string; params: unknown[] } {
  let sql = "";
  const params: unknown[] = [];

  for (let i = 0; i < strings.length; i++) {
    sql += strings[i];
    if (i < paramValues.length) {
      const val = paramValues[i];
      if (isPgFragment(val)) {
        sql += val.sql;
        params.push(...val.params);
      } else {
        params.push(val);
        sql += `$${params.length}`;
      }
    }
  }

  return { sql, params };
}

/**
 * Creates a base interpreter for `postgres/*` node kinds.
 *
 * Handles query, identifier, insert_helper, and set_helper nodes.
 * For begin, savepoint, and cursor, use createPostgresServerInterpreter.
 *
 * @param client - The {@link PostgresClient} to execute against.
 * @returns An Interpreter handling postgres node kinds.
 */
export function createPostgresInterpreter(client: PostgresClient): Interpreter {
  return {
    "postgres/query": async function* (entry: RuntimeEntry) {
      const numStrings = (yield 0) as number;
      const strings: string[] = [];
      for (let i = 0; i < numStrings; i++) {
        strings.push((yield 1 + i) as string);
      }
      const paramValues: unknown[] = [];
      for (let i = 1 + numStrings; i < entry.children.length; i++) {
        paramValues.push(yield i);
      }
      const { sql, params } = buildQuerySQL(strings, paramValues);
      return await client.query(sql, params);
    },

    "postgres/identifier": async function* (_entry: RuntimeEntry) {
      const name = (yield 0) as string;
      return { __pgFragment: true, sql: escapeIdentifier(name), params: [] } as PgFragment;
    },

    "postgres/insert_helper": async function* (_entry: RuntimeEntry) {
      const data = (yield 0) as Record<string, unknown> | Record<string, unknown>[];
      const columnsJson = (yield 1) as string;
      const parsedColumns = JSON.parse(columnsJson) as string[] | null;
      const columns = parsedColumns ?? Object.keys(Array.isArray(data) ? data[0] : data);
      const rows = Array.isArray(data) ? data : [data];
      const params: unknown[] = [];
      const sql =
        "(" +
        columns.map(escapeIdentifier).join(",") +
        ") values " +
        rows
          .map(
            (row) =>
              "(" +
              columns
                .map((col) => {
                  params.push(row[col]);
                  return `$${params.length}`;
                })
                .join(",") +
              ")",
          )
          .join(",");
      return { __pgFragment: true, sql, params } as PgFragment;
    },

    "postgres/set_helper": async function* (_entry: RuntimeEntry) {
      const data = (yield 0) as Record<string, unknown>;
      const columnsJson = (yield 1) as string;
      const parsedColumns = JSON.parse(columnsJson) as string[] | null;
      const columns = parsedColumns ?? Object.keys(data);
      const params: unknown[] = [];
      const sql = columns
        .map((col) => {
          params.push(data[col]);
          return `${escapeIdentifier(col)}=$${params.length}`;
        })
        .join(",");
      return { __pgFragment: true, sql, params } as PgFragment;
    },

    "postgres/begin": async function* (_entry: RuntimeEntry) {
      throw new Error(
        "postgres/begin requires the server interpreter — use createPostgresServerInterpreter",
      );
    },

    "postgres/savepoint": async function* (_entry: RuntimeEntry) {
      throw new Error(
        "postgres/savepoint requires the server interpreter — use createPostgresServerInterpreter",
      );
    },

    "postgres/cursor": async function* (_entry: RuntimeEntry) {
      throw new Error(
        "postgres/cursor requires the server interpreter — use createPostgresServerInterpreter",
      );
    },

    "postgres/cursor_batch": async function* (_entry: RuntimeEntry) {
      throw new Error(
        "postgres/cursor_batch requires the server interpreter — use createPostgresServerInterpreter",
      );
    },

    "postgres/record": async function* (entry: RuntimeEntry) {
      const result: Record<string, unknown> = {};
      for (let i = 0; i < entry.children.length; i += 2) {
        const key = (yield i) as string;
        const value = yield i + 1;
        result[key] = value;
      }
      return result;
    },

    "postgres/array": async function* (entry: RuntimeEntry) {
      const result: unknown[] = [];
      for (let i = 0; i < entry.children.length; i++) {
        result.push(yield i);
      }
      return result;
    },
  };
}
