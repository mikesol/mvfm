import type { Interpreter, TypedNode } from "@mvfm/core";
import { eval_ } from "@mvfm/core";

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

interface BuiltQuery {
  sql: string;
  params: unknown[];
}

interface PostgresQueryNode extends TypedNode<unknown[]> {
  kind: "postgres/query";
  strings: string[];
  params: TypedNode[];
}

interface PostgresBeginNode extends TypedNode<unknown> {
  kind: "postgres/begin";
  mode: string;
  body?: TypedNode;
  queries?: TypedNode[];
}

interface PostgresSavepointNode extends TypedNode<unknown> {
  kind: "postgres/savepoint";
  mode: string;
  body?: TypedNode;
  queries?: TypedNode[];
}

interface PostgresCursorNode extends TypedNode<unknown> {
  kind: "postgres/cursor";
  query: PostgresQueryNode;
  batchSize: TypedNode<number>;
  body: TypedNode;
}

/**
 * Build parameterized SQL from a postgres/query AST node.
 * Resolves identifier, insert_helper, and set_helper fragments inline.
 */
export async function* buildSQL(
  node: PostgresQueryNode,
): AsyncGenerator<TypedNode, BuiltQuery, unknown> {
  const strings = node.strings;
  const paramNodes = node.params;
  let sql = "";
  const params: unknown[] = [];

  for (let i = 0; i < strings.length; i++) {
    sql += strings[i];
    if (i < paramNodes.length) {
      const param = paramNodes[i] as any;
      if (param.kind === "postgres/identifier") {
        const name = (yield* eval_<string>(param.name)) as string;
        sql += escapeIdentifier(name);
      } else if (param.kind === "postgres/insert_helper") {
        const data = (yield* eval_(param.data)) as
          | Record<string, unknown>
          | Record<string, unknown>[];
        const columns =
          (param.columns as string[] | null) ?? Object.keys(Array.isArray(data) ? data[0] : data);
        const rows = Array.isArray(data) ? data : [data];
        sql +=
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
      } else if (param.kind === "postgres/set_helper") {
        const data = (yield* eval_(param.data)) as Record<string, unknown>;
        const columns = (param.columns as string[] | null) ?? Object.keys(data);
        sql += columns
          .map((col) => {
            params.push(data[col]);
            return `${escapeIdentifier(col)}=$${params.length}`;
          })
          .join(",");
      } else {
        params.push(yield* eval_(param));
        sql += `$${params.length}`;
      }
    }
  }

  return { sql, params };
}

/**
 * Find the postgres/cursor_batch node within an AST subtree.
 *
 * The handler uses this to locate the batch data injection point
 * within cursor body expressions.
 */
export function findCursorBatch(node: any): any | null {
  if (node === null || node === undefined || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findCursorBatch(item);
      if (found) return found;
    }
    return null;
  }
  if (node.kind === "postgres/cursor_batch") return node;
  for (const v of Object.values(node)) {
    if (typeof v === "object" && v !== null) {
      const found = findCursorBatch(v);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Creates a base interpreter for `postgres/*` node kinds.
 *
 * For query, identifier, insert_helper, and set_helper nodes this does
 * SQL construction. For begin, savepoint, and cursor nodes this requires
 * a full interpreter + foldAST — use the server handler for those.
 *
 * @param client - The {@link PostgresClient} to execute against.
 * @returns An Interpreter handling postgres node kinds.
 */
export function createPostgresInterpreter(client: PostgresClient): Interpreter {
  return {
    "postgres/query": async function* (node: PostgresQueryNode) {
      const { sql, params } = yield* buildSQL(node);
      return await client.query(sql, params);
    },

    // biome-ignore lint/correctness/useYield: stub throws before yielding
    "postgres/begin": async function* (_node: PostgresBeginNode) {
      throw new Error(
        "postgres/begin requires the full interpreter — use createPostgresServerInterpreter",
      );
    },

    // biome-ignore lint/correctness/useYield: stub throws before yielding
    "postgres/savepoint": async function* (_node: PostgresSavepointNode) {
      throw new Error(
        "postgres/savepoint requires the full interpreter — use createPostgresServerInterpreter",
      );
    },

    // biome-ignore lint/correctness/useYield: stub throws before yielding
    "postgres/cursor": async function* (_node: PostgresCursorNode) {
      throw new Error(
        "postgres/cursor requires the full interpreter — use createPostgresServerInterpreter",
      );
    },

    // biome-ignore lint/correctness/useYield: returns data without needing child evaluation
    "postgres/cursor_batch": async function* (node: any) {
      return node.__batchData;
    },

    // biome-ignore lint/correctness/useYield: stub throws before yielding
    "postgres/identifier": async function* () {
      throw new Error(
        "postgres/identifier should be resolved during SQL construction, not visited directly",
      );
    },

    // biome-ignore lint/correctness/useYield: stub throws before yielding
    "postgres/insert_helper": async function* () {
      throw new Error(
        "postgres/insert_helper should be resolved during SQL construction, not visited directly",
      );
    },

    // biome-ignore lint/correctness/useYield: stub throws before yielding
    "postgres/set_helper": async function* () {
      throw new Error(
        "postgres/set_helper should be resolved during SQL construction, not visited directly",
      );
    },
  };
}
