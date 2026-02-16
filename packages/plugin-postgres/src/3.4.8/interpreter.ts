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

// --- Typed node interfaces -------------------------------------------

/** A `postgres/identifier` node for dynamic SQL identifiers. */
export interface PostgresIdentifierNode extends TypedNode<string> {
  kind: "postgres/identifier";
  name: TypedNode<string>;
}

/** A `postgres/insert_helper` node for bulk INSERT value construction. */
export interface PostgresInsertHelperNode extends TypedNode<string> {
  kind: "postgres/insert_helper";
  data: TypedNode<Record<string, unknown> | Record<string, unknown>[]>;
  columns?: string[];
}

/** A `postgres/set_helper` node for UPDATE SET clause construction. */
export interface PostgresSetHelperNode extends TypedNode<string> {
  kind: "postgres/set_helper";
  data: TypedNode<Record<string, unknown>>;
  columns?: string[];
}

/** Discriminated union of parameter node types within a `postgres/query`. */
export type PostgresParamNode =
  | PostgresIdentifierNode
  | PostgresInsertHelperNode
  | PostgresSetHelperNode
  | TypedNode;

/** A `postgres/query` node representing a parameterized SQL query. */
export interface PostgresQueryNode extends TypedNode<unknown[]> {
  kind: "postgres/query";
  strings: string[];
  params: PostgresParamNode[];
}

/** A `postgres/begin` node representing a transaction block. */
export interface PostgresBeginNode extends TypedNode<unknown> {
  kind: "postgres/begin";
  mode: string;
  body?: TypedNode;
  queries?: TypedNode[];
}

/** A `postgres/savepoint` node representing a savepoint block. */
export interface PostgresSavepointNode extends TypedNode<unknown> {
  kind: "postgres/savepoint";
  mode: string;
  body?: TypedNode;
  queries?: TypedNode[];
}

/** A `postgres/cursor` node representing a streaming cursor query. */
export interface PostgresCursorNode extends TypedNode<unknown> {
  kind: "postgres/cursor";
  query: PostgresQueryNode;
  batchSize: TypedNode<number>;
  body: TypedNode;
}

/** A `postgres/cursor_batch` node — yields the current batch inside a cursor body. */
export interface PostgresCursorBatchNode extends TypedNode<unknown[]> {
  kind: "postgres/cursor_batch";
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
      const param = paramNodes[i];
      if (param.kind === "postgres/identifier") {
        const id = param as PostgresIdentifierNode;
        const name = (yield* eval_<string>(id.name)) as string;
        sql += escapeIdentifier(name);
      } else if (param.kind === "postgres/insert_helper") {
        const ins = param as PostgresInsertHelperNode;
        const data = (yield* eval_(ins.data)) as
          | Record<string, unknown>
          | Record<string, unknown>[];
        const columns = ins.columns ?? Object.keys(Array.isArray(data) ? data[0] : data);
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
        const set = param as PostgresSetHelperNode;
        const data = (yield* eval_(set.data)) as Record<string, unknown>;
        const columns = set.columns ?? Object.keys(data);
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

    // biome-ignore lint/correctness/useYield: stub throws before yielding
    "postgres/cursor_batch": async function* (_node: PostgresCursorBatchNode) {
      throw new Error(
        "postgres/cursor_batch requires the server interpreter — use createPostgresServerInterpreter",
      );
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
