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

import type { CExpr, KindSpec } from "@mvfm/core";
import { isCExpr, makeCExpr } from "@mvfm/core";

// ---- What the plugin adds to $ ----------------------------

/**
 * Database operations added to the DSL context by the postgres plugin.
 *
 * Mirrors the postgres.js (porsager/postgres) v3.4.x API as closely
 * as possible: tagged template queries, dynamic identifiers, insert/set
 * helpers, transactions, savepoints, and cursors.
 */
export interface PostgresMethods {
  /** Tagged template query and helper methods. */
  sql: PostgresSql;
}

/** Tagged template + helpers for the postgres plugin. */
export interface PostgresSql {
  /** Tagged template query. */
  <T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]): CExpr<T[]>;

  /** Dynamic identifier escaping. */
  id(name: unknown): CExpr<unknown>;

  /** Dynamic INSERT helper. */
  insert(data: unknown, columns?: string[]): CExpr<unknown>;

  /** Dynamic SET helper. */
  set(data: unknown, columns?: string[]): CExpr<unknown>;

  /** Transaction block. */
  begin<T>(fn: (sql: PostgresTxSql) => unknown): CExpr<T>;

  /** Cursor iteration. */
  cursor<T = Record<string, unknown>>(
    query: CExpr<T[]>,
    batchSize: unknown,
    fn: (batch: CExpr<T[]>) => unknown,
  ): CExpr<void>;
}

/** Scoped sql inside a transaction (has savepoint, no begin). */
export interface PostgresTxSql {
  /** Tagged template query. */
  <T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]): CExpr<T[]>;

  /** Dynamic identifier escaping. */
  id(name: unknown): CExpr<unknown>;

  /** Dynamic INSERT helper. */
  insert(data: unknown, columns?: string[]): CExpr<unknown>;

  /** Dynamic SET helper. */
  set(data: unknown, columns?: string[]): CExpr<unknown>;

  /** Savepoint block. */
  savepoint<T>(fn: (sql: PostgresTxSql) => unknown): CExpr<T>;

  /** Cursor iteration. */
  cursor<T = Record<string, unknown>>(
    query: CExpr<T[]>,
    batchSize: unknown,
    fn: (batch: CExpr<T[]>) => unknown,
  ): CExpr<void>;
}

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

// ---- Node kinds -------------------------------------------

function buildKinds(): Record<string, KindSpec<any, any>> {
  return {
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
    "postgres/record": {
      inputs: [] as unknown[],
      output: {} as Record<string, unknown>,
    } as KindSpec<unknown[], Record<string, unknown>>,
    "postgres/array": {
      inputs: [] as unknown[],
      output: [] as unknown[],
    } as KindSpec<unknown[], unknown[]>,
  };
}

// ---- Lift helper ------------------------------------------

/**
 * Recursively lifts a plain value into a CExpr tree.
 * - CExpr values are returned as-is.
 * - Primitives are returned as-is (elaborate lifts them via liftMap).
 * - Plain objects become `postgres/record` CExprs with key-value pairs.
 * - Arrays become `postgres/array` CExprs.
 */
function liftArg(value: unknown): unknown {
  if (isCExpr(value)) return value;
  if (typeof value === "string") return value;
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return makeCExpr("postgres/array", value.map(liftArg));
  }
  if (typeof value === "object") {
    const pairs: unknown[] = [];
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      pairs.push(k, liftArg(v));
    }
    return makeCExpr("postgres/record", pairs);
  }
  return value;
}

// ---- Constructor builder ----------------------------------

/**
 * Builds the postgres constructor methods using makeCExpr.
 *
 * CExpr children layout per kind:
 * - query:         [numStrings, ...stringParts, ...paramExprs]
 * - identifier:    [nameExpr]
 * - insert_helper: [dataExpr, columnsJson]
 * - set_helper:    [dataExpr, columnsJson]
 * - begin:         [modeStr, ...bodyOrQueries]
 * - savepoint:     [modeStr, ...bodyOrQueries]
 * - cursor:        [queryExpr, batchSizeExpr, bodyExpr]
 * - cursor_batch:  [] (sentinel)
 * - record:        [key0, val0, key1, val1, ...]
 * - array:         [elem0, elem1, ...]
 */
function buildPostgresApi(): PostgresMethods["sql"] {
  function makeSql(scope: "top" | "transaction" | "savepoint"): PostgresSql {
    const baseFn = (strings: TemplateStringsArray, ...values: unknown[]): CExpr<unknown[]> =>
      makeCExpr("postgres/query", [strings.length, ...Array.from(strings), ...values]);

    const id = (name: unknown): CExpr<unknown> => makeCExpr("postgres/identifier", [name]);

    const insert = (data: unknown, columns?: string[]): CExpr<unknown> =>
      makeCExpr("postgres/insert_helper", [liftArg(data), JSON.stringify(columns ?? null)]);

    const set = (data: unknown, columns?: string[]): CExpr<unknown> =>
      makeCExpr("postgres/set_helper", [liftArg(data), JSON.stringify(columns ?? null)]);

    const cursor = (query: unknown, batchSize: unknown, fn: Function): CExpr<void> => {
      const batchProxy = makeCExpr("postgres/cursor_batch", []);
      return makeCExpr("postgres/cursor", [query, batchSize, fn(batchProxy)]);
    };

    const props: Record<string, unknown> = { id, insert, set, cursor };

    if (scope === "top") {
      props.begin = (fn: Function) => {
        const txSql = makeSql("transaction");
        const result = fn(txSql);
        if (Array.isArray(result)) {
          return makeCExpr("postgres/begin", ["pipeline", ...result]);
        }
        return makeCExpr("postgres/begin", ["callback", result]);
      };
    }

    if (scope === "transaction" || scope === "savepoint") {
      props.savepoint = (fn: Function) => {
        const spSql = makeSql("savepoint");
        const result = fn(spSql);
        if (Array.isArray(result)) {
          return makeCExpr("postgres/savepoint", ["pipeline", ...result]);
        }
        return makeCExpr("postgres/savepoint", ["callback", result]);
      };
    }

    return Object.assign(baseFn, props) as unknown as PostgresSql;
  }

  return makeSql("top");
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
    kinds: buildKinds(),
    traits: {},
    lifts: {},
  };
}

/** Alias for {@link postgres}, kept for readability at call sites. */
export const postgresPlugin = postgres;
