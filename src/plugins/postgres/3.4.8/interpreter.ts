import type { ASTNode, InterpreterFragment, StepEffect } from "../../../core";

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

/**
 * Build parameterized SQL from a postgres/query AST node.
 * Resolves identifier, insert_helper, and set_helper fragments inline
 * by yielding recurse effects via `yield*` delegation.
 */
function* buildSQL(node: ASTNode): Generator<StepEffect, BuiltQuery, unknown> {
  const strings = node.strings as string[];
  const paramNodes = node.params as ASTNode[];
  let sql = "";
  const params: unknown[] = [];

  for (let i = 0; i < strings.length; i++) {
    sql += strings[i];
    if (i < paramNodes.length) {
      const param = paramNodes[i];
      if (param.kind === "postgres/identifier") {
        const name = (yield { type: "recurse", child: param.name as ASTNode }) as string;
        sql += escapeIdentifier(name);
      } else if (param.kind === "postgres/insert_helper") {
        const data = (yield { type: "recurse", child: param.data as ASTNode }) as
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
        const data = (yield { type: "recurse", child: param.data as ASTNode }) as Record<
          string,
          unknown
        >;
        const columns = (param.columns as string[] | null) ?? Object.keys(data);
        sql += columns
          .map((col) => {
            params.push(data[col]);
            return `${escapeIdentifier(col)}=$${params.length}`;
          })
          .join(",");
      } else {
        // Regular parameter -- recurse to get the value
        params.push(yield { type: "recurse", child: param });
        sql += `$${params.length}`;
      }
    }
  }

  return { sql, params };
}

/**
 * Generator-based interpreter fragment for postgres plugin nodes.
 *
 * Yields effects for database operations (`query`, `begin`, `savepoint`,
 * `cursor`) that are handled by a {@link StepHandler} (e.g. the server
 * handler or client handler).
 */
export const postgresInterpreter: InterpreterFragment = {
  pluginName: "postgres",
  canHandle: (node) => node.kind.startsWith("postgres/"),
  *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
    switch (node.kind) {
      case "postgres/query": {
        const { sql, params } = yield* buildSQL(node);
        return yield { type: "query", sql, params };
      }

      case "postgres/begin": {
        return yield {
          type: "begin",
          mode: node.mode as string,
          body: node.body as ASTNode | undefined,
          queries: node.queries as ASTNode[] | undefined,
        };
      }

      case "postgres/savepoint": {
        return yield {
          type: "savepoint",
          mode: node.mode as string,
          body: node.body as ASTNode | undefined,
          queries: node.queries as ASTNode[] | undefined,
        };
      }

      case "postgres/cursor": {
        const queryNode = node.query as ASTNode;
        const { sql, params } = yield* buildSQL(queryNode);
        const batchSize = (yield { type: "recurse", child: node.batchSize as ASTNode }) as number;
        return yield {
          type: "cursor",
          sql,
          params,
          batchSize,
          body: node.body as ASTNode,
        };
      }

      case "postgres/cursor_batch":
        return (node as any).__batchData;

      // These are resolved inline by buildSQL, never visited directly
      case "postgres/identifier":
      case "postgres/insert_helper":
      case "postgres/set_helper":
        throw new Error(
          `${node.kind} should be resolved during SQL construction, not visited directly`,
        );

      default:
        throw new Error(`Postgres interpreter: unknown node kind "${node.kind}"`);
    }
  },
  isVolatile: (node) => node.kind === "postgres/cursor_batch",
};

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
