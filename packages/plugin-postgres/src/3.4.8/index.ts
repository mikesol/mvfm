// ============================================================
// MVFM PLUGIN: postgres (porsager/postgres compatible API)
// ============================================================
//
// Ported to the unified Plugin type with makeCExpr and
// index-based fold handlers. Config captured in interpreter
// closure, not stored on AST nodes.
//
// NO defaultInterpreter — requires createPostgresServerInterpreter().
//
// Known limitations (deliberate omissions):
//   - No COPY (streaming bulk import/export)
//   - No LISTEN/NOTIFY (async pub/sub channels)
//   - No SUBSCRIBE (realtime logical replication)
// ============================================================

import type { KindSpec, Plugin } from "@mvfm/core";
import { buildPostgresApi } from "./build-methods";

// ---- Configuration ----------------------------------------

/**
 * Connection configuration for the postgres plugin.
 *
 * Accepts the same options as postgres.js: connection string or
 * individual host/port/database/username/password fields, plus
 * SSL, connection pool size, and column name transforms.
 */
export interface PostgresConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean | object;
  max?: number;
  transform?: {
    column?: { to?: string; from?: string };
  };
}

// ---- Plugin factory ---------------------------------------

/**
 * Creates the postgres plugin definition (unified Plugin type).
 *
 * This plugin has NO defaultInterpreter. You must provide one
 * via `defaults(plugins, { postgres: createPostgresServerInterpreter(...) })`.
 *
 * @param config - A connection string or {@link PostgresConfig} object.
 *   Config is captured by the interpreter, not stored on AST nodes.
 * @returns A unified Plugin that contributes `$.sql`.
 */
export function postgres(config?: PostgresConfig | string) {
  const _resolvedConfig: PostgresConfig =
    typeof config === "string" ? { connectionString: config } : (config ?? {});

  return {
    name: "postgres" as const,
    ctors: { sql: buildPostgresApi() },
    kinds: {
      "postgres/query": {
        inputs: [0] as [number, ...unknown[]],
        output: [] as unknown[],
      } as KindSpec<[number, ...unknown[]], unknown[]>,
      "postgres/identifier": {
        inputs: [undefined] as [unknown],
        output: undefined as unknown,
      } as KindSpec<[unknown], unknown>,
      "postgres/insert_helper": {
        inputs: [undefined, ""] as [unknown, string],
        output: undefined as unknown,
      } as KindSpec<[unknown, string], unknown>,
      "postgres/set_helper": {
        inputs: [undefined, ""] as [unknown, string],
        output: undefined as unknown,
      } as KindSpec<[unknown, string], unknown>,
      "postgres/begin": {
        inputs: [""] as [string, ...unknown[]],
        output: undefined as unknown,
      } as KindSpec<[string, ...unknown[]], unknown>,
      "postgres/savepoint": {
        inputs: [""] as [string, ...unknown[]],
        output: undefined as unknown,
      } as KindSpec<[string, ...unknown[]], unknown>,
      "postgres/cursor": {
        inputs: [undefined, undefined, undefined] as [unknown, unknown, unknown],
        output: undefined as unknown as undefined,
      } as KindSpec<[unknown, unknown, unknown], void>,
      "postgres/cursor_batch": {
        inputs: [] as [],
        output: [] as unknown[],
      } as KindSpec<[], unknown[]>,
    },
    shapes: {
      "postgres/insert_helper": ["*", null],
      "postgres/set_helper": ["*", null],
    },
    traits: {},
    lifts: {},
  } satisfies Plugin;
}

/** Alias for {@link postgres}, kept for readability at call sites. */
export const postgresPlugin = postgres;
