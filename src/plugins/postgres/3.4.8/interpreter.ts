import type { ASTNode, InterpreterFragment } from "../../../core";
import { composeInterpreters } from "../../../core";

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

// Escape identifier — matches postgres.js src/types.js:216
function escapeIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""').replace(/\./g, '"."')}"`;
}

interface BuiltQuery {
  sql: string;
  params: unknown[];
}

// Build parameterized SQL from a postgres/query AST node.
// Resolves identifier, insert_helper, and set_helper fragments inline.
async function buildSQL(
  node: ASTNode,
  recurse: (n: ASTNode) => Promise<unknown>,
): Promise<BuiltQuery> {
  const strings = node.strings as string[];
  const paramNodes = node.params as ASTNode[];
  let sql = "";
  const params: unknown[] = [];

  for (let i = 0; i < strings.length; i++) {
    sql += strings[i];
    if (i < paramNodes.length) {
      const param = paramNodes[i];
      if (param.kind === "postgres/identifier") {
        const name = (await recurse(param.name as ASTNode)) as string;
        sql += escapeIdentifier(name);
      } else if (param.kind === "postgres/insert_helper") {
        const data = (await recurse(param.data as ASTNode)) as
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
        const data = (await recurse(param.data as ASTNode)) as Record<string, unknown>;
        const columns = (param.columns as string[] | null) ?? Object.keys(data);
        sql += columns
          .map((col) => {
            params.push(data[col]);
            return `${escapeIdentifier(col)}=$${params.length}`;
          })
          .join(",");
      } else {
        // Regular parameter — recurse to get the value
        params.push(await recurse(param));
        sql += `$${params.length}`;
      }
    }
  }

  return { sql, params };
}

export function postgresInterpreter(
  client: PostgresClient,
  outerFragments?: InterpreterFragment[],
): InterpreterFragment {
  return {
    pluginName: "postgres",
    canHandle: (node) => node.kind.startsWith("postgres/"),
    async visit(node: ASTNode, recurse: (node: ASTNode) => Promise<unknown>): Promise<unknown> {
      switch (node.kind) {
        case "postgres/query": {
          const { sql, params } = await buildSQL(node, recurse);
          return client.query(sql, params);
        }

        case "postgres/begin": {
          return client.begin(async (tx) => {
            const txFragment = postgresInterpreter(tx, outerFragments);
            const txRecurse: (n: ASTNode) => Promise<unknown> = outerFragments
              ? composeInterpreters([txFragment, ...outerFragments])
              : async (n: ASTNode): Promise<unknown> => {
                  if (txFragment.canHandle(n)) return txFragment.visit(n, txRecurse);
                  return recurse(n);
                };

            if (node.mode === "pipeline") {
              const queries = node.queries as ASTNode[];
              const results: unknown[] = [];
              for (const q of queries) {
                results.push(await txRecurse(q));
              }
              return results;
            }
            // callback mode
            return await txRecurse(node.body as ASTNode);
          });
        }

        case "postgres/savepoint": {
          return client.savepoint(async (tx) => {
            const txFragment = postgresInterpreter(tx, outerFragments);
            const txRecurse: (n: ASTNode) => Promise<unknown> = outerFragments
              ? composeInterpreters([txFragment, ...outerFragments])
              : async (n: ASTNode): Promise<unknown> => {
                  if (txFragment.canHandle(n)) return txFragment.visit(n, txRecurse);
                  return recurse(n);
                };

            if (node.mode === "pipeline") {
              const queries = node.queries as ASTNode[];
              const results: unknown[] = [];
              for (const q of queries) {
                results.push(await txRecurse(q));
              }
              return results;
            }
            return await txRecurse(node.body as ASTNode);
          });
        }

        case "postgres/cursor": {
          const queryNode = node.query as ASTNode;
          const { sql, params } = await buildSQL(queryNode, recurse);
          const batchSize = (await recurse(node.batchSize as ASTNode)) as number;

          await client.cursor(sql, params, batchSize, async (rows) => {
            const bodyClone = structuredClone(node.body) as ASTNode;
            injectCursorBatch(bodyClone, rows);
            await recurse(bodyClone);
            return undefined;
          });
          return;
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
  };
}

function injectCursorBatch(node: any, rows: unknown[]): void {
  if (node === null || node === undefined || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) injectCursorBatch(item, rows);
    return;
  }
  if (node.kind === "postgres/cursor_batch") {
    node.__batchData = rows;
  }
  for (const v of Object.values(node)) {
    if (typeof v === "object" && v !== null) {
      injectCursorBatch(v, rows);
    }
  }
}
