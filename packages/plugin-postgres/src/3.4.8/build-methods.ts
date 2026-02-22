import type { CExpr } from "@mvfm/core";
import { isCExpr, makeCExpr } from "@mvfm/core";

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

// liftArg erases generic type info at runtime (returns unknown).
// Cast helper restores the declared CExpr Args types for ExtractKinds.
const mk = makeCExpr as <O, Kind extends string, Args extends readonly unknown[]>(
  kind: Kind,
  args: readonly unknown[],
) => CExpr<O, Kind, Args>;

/**
 * Builds the postgres constructor methods using makeCExpr + liftArg.
 *
 * Each method produces a CExpr node with positional children.
 * Config is NOT stored on AST nodes -- it's captured by the interpreter.
 *
 * Constructors use permissive generics so any argument type is accepted
 * at construction time. Validation happens at `app()` time via KindSpec.
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
export function buildPostgresApi() {
  function makeSql(scope: "top" | "transaction" | "savepoint") {
    const baseFn = <T = Record<string, unknown>>(
      strings: TemplateStringsArray,
      ...values: unknown[]
    ): CExpr<T[], "postgres/query", unknown[]> =>
      mk("postgres/query", [strings.length, ...Array.from(strings), ...values]);

    const props: Record<string, unknown> = {
      /** Dynamic identifier escaping. */
      id<A>(name: A): CExpr<unknown, "postgres/identifier", [A]> {
        return mk("postgres/identifier", [name]);
      },

      /** Dynamic INSERT helper. */
      insert<A>(
        data: A,
        columns?: string[],
      ): CExpr<unknown, "postgres/insert_helper", [A, string]> {
        return mk("postgres/insert_helper", [liftArg(data), JSON.stringify(columns ?? null)]);
      },

      /** Dynamic SET helper. */
      set<A>(data: A, columns?: string[]): CExpr<unknown, "postgres/set_helper", [A, string]> {
        return mk("postgres/set_helper", [liftArg(data), JSON.stringify(columns ?? null)]);
      },

      /** Cursor iteration. */
      cursor<T = Record<string, unknown>>(
        query: CExpr<T[]>,
        batchSize: unknown,
        fn: (batch: CExpr<T[]>) => unknown,
      ): CExpr<void, "postgres/cursor", [CExpr<T[]>, unknown, unknown]> {
        const batchProxy = makeCExpr("postgres/cursor_batch", []);
        return mk("postgres/cursor", [query, batchSize, fn(batchProxy as CExpr<T[]>)]);
      },
    };

    if (scope === "top") {
      /** Transaction block. */
      props.begin = <T>(
        fn: (sql: ReturnType<typeof makeSql>) => unknown,
      ): CExpr<T, "postgres/begin", [string, ...unknown[]]> => {
        const txSql = makeSql("transaction");
        const result = fn(txSql);
        if (Array.isArray(result)) {
          return mk("postgres/begin", ["pipeline", ...result]);
        }
        return mk("postgres/begin", ["callback", result]);
      };
    }

    if (scope === "transaction" || scope === "savepoint") {
      /** Savepoint block. */
      props.savepoint = <T>(
        fn: (sql: ReturnType<typeof makeSql>) => unknown,
      ): CExpr<T, "postgres/savepoint", [string, ...unknown[]]> => {
        const spSql = makeSql("savepoint");
        const result = fn(spSql);
        if (Array.isArray(result)) {
          return mk("postgres/savepoint", ["pipeline", ...result]);
        }
        return mk("postgres/savepoint", ["callback", result]);
      };
    }

    return Object.assign(baseFn, props);
  }

  return makeSql("top");
}
