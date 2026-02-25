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

// ---- Plugin definition ------------------------------------

/**
 * The postgres plugin definition (unified Plugin type).
 *
 * This plugin has NO defaultInterpreter. You must provide one
 * via `defaults(plugins, { postgres: createPostgresServerInterpreter(...) })`.
 *
 * Contributes `$.sql`.
 */
export const postgres = {
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

/** Alias for {@link postgres}, kept for readability at call sites. */
export const postgresPlugin = postgres;
