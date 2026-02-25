import type { CExpr, Liftable } from "@mvfm/core";
import { makeCExpr } from "@mvfm/core";

/**
 * Builds the postgres constructor methods using makeCExpr.
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
 */
export function buildPostgresApi() {
  function makeSql(scope: "top" | "transaction" | "savepoint") {
    const baseFn = <T = Record<string, unknown>>(
      strings: TemplateStringsArray,
      ...values: unknown[]
    ): CExpr<T[], "postgres/query", unknown[]> =>
      makeCExpr("postgres/query", [strings.length, ...Array.from(strings), ...values]) as any;

    const props: Record<string, unknown> = {
      /** Dynamic identifier escaping. */
      id<A>(name: A): CExpr<unknown, "postgres/identifier", [A]> {
        return makeCExpr("postgres/identifier", [name]) as any;
      },

      /** Dynamic INSERT helper. */
      insert(
        data: Liftable<Record<string, unknown>>,
        columns?: string[],
      ): CExpr<unknown, "postgres/insert_helper", [Liftable<Record<string, unknown>>, string]> {
        return makeCExpr("postgres/insert_helper", [data, JSON.stringify(columns ?? null)]) as any;
      },

      /** Dynamic SET helper. */
      set(
        data: Liftable<Record<string, unknown>>,
        columns?: string[],
      ): CExpr<unknown, "postgres/set_helper", [Liftable<Record<string, unknown>>, string]> {
        return makeCExpr("postgres/set_helper", [data, JSON.stringify(columns ?? null)]) as any;
      },

      /** Cursor iteration. */
      cursor<T = Record<string, unknown>>(
        query: CExpr<T[]>,
        batchSize: unknown,
        fn: (batch: CExpr<T[]>) => unknown,
      ): CExpr<void, "postgres/cursor", [CExpr<T[]>, unknown, unknown]> {
        const batchProxy = makeCExpr("postgres/cursor_batch", []);
        return makeCExpr("postgres/cursor", [
          query,
          batchSize,
          fn(batchProxy as CExpr<T[]>),
        ]) as any;
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
          return makeCExpr("postgres/begin", ["pipeline", ...result]) as any;
        }
        return makeCExpr("postgres/begin", ["callback", result]) as any;
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
          return makeCExpr("postgres/savepoint", ["pipeline", ...result]) as any;
        }
        return makeCExpr("postgres/savepoint", ["callback", result]) as any;
      };
    }

    return Object.assign(baseFn, props);
  }

  return makeSql("top");
}
