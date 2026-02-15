// ============================================================
// MVFM PLUGIN: fiber — concurrency primitives
// ============================================================
//
// This plugin provides the concurrency model for Mvfm programs.
// It doesn't know about postgres, fetch, or any specific effect —
// it just provides combinators that work with any Expr.
//
// The key idea: $.par(), $.seq(), $.race() are just AST nodes.
// The interpreter decides how to execute them. The program
// describes the concurrency structure; the runtime implements it.
//
// DESIGN PRINCIPLES:
//
// 1. Sequential is the default. $.do(a, b, c) runs in order.
//    You opt INTO parallelism, not out of it.
//
// 2. Parallelism always has a concurrency limit. No unbounded
//    Promise.all footguns.
//
// 3. The concurrency structure is part of the verified program.
//    The proxy server can enforce "this program runs at most
//    5 queries in parallel" because it's in the AST.
//
// 4. Plugins like postgres don't depend on fiber. They just
//    produce Expr values. fiber provides combinators that
//    compose those values with concurrency semantics.
//
// ============================================================

import type { ASTNode, Expr, PluginContext, PluginDefinition } from "../../core";

// ---- What the plugin adds to $ ----------------------------

/**
 * Concurrency primitives added to the DSL context.
 *
 * Provides par, seq, race, timeout, and retry combinators that
 * describe concurrency structure in the AST for the interpreter
 * to execute.
 */
export interface FiberMethods {
  /**
   * Run expressions in parallel, return all results.
   * This is the safe `Promise.all` -- with mandatory concurrency limit.
   *
   * ```
   * // Run 3 things concurrently (default concurrency = Infinity for tuple form)
   * const [users, posts, stats] = $.par(
   *   $.sql`select * from users`,
   *   $.sql`select * from posts`,
   *   $.fetch`https://api.example.com/stats`
   * )
   *
   * // Map over a collection with bounded concurrency
   * const details = $.par(userIds, { concurrency: 5 }, (id) =>
   *   $.sql`select * from details where user_id = ${id}`
   * )
   * ```
   */
  par: ParFn;

  /**
   * Run expressions sequentially, return last result.
   * This is `$.do()` with fiber awareness -- each step is
   * guaranteed to complete before the next starts.
   *
   * Alias for `$.do()` but makes the intent clearer in
   * a concurrent context.
   *
   * ```
   * $.seq(
   *   $.sql`insert into users ...`,
   *   $.sql`insert into accounts ...`,
   *   $.sql`select * from users where ...`  // returned
   * )
   * ```
   */
  seq(...exprs: (Expr<any> | any)[]): Expr<any>;

  /**
   * Run expressions concurrently, return the first to complete.
   * Other branches are conceptually cancelled.
   *
   *   const data = $.race(
   *     $.fetch`https://primary.api.com/data`,
   *     $.fetch`https://fallback.api.com/data`
   *   )
   */
  race(...exprs: Expr<any>[]): Expr<any>;

  /**
   * Timeout an expression. If it doesn't complete within
   * the given milliseconds, the fallback is used.
   *
   * ```
   * const data = $.timeout(
   *   $.fetch`https://slow.api.com/data`,
   *   5000,
   *   { error: 'timeout' }  // fallback value
   * )
   * ```
   */
  timeout(expr: Expr<any>, ms: number | Expr<number>, fallback: Expr<any> | any): Expr<any>;

  /**
   * Retry an expression up to N times with optional delay.
   *
   * ```
   * const data = $.retry(
   *   $.fetch`https://flaky.api.com/data`,
   *   { attempts: 3, delay: 1000 }
   * )
   * ```
   */
  retry(expr: Expr<any>, opts: { attempts: number; delay?: number }): Expr<any>;
}

// Overloaded par signature
interface ParFn {
  // Tuple form: $.par(a, b, c) — run fixed set of expressions
  <A, B>(a: Expr<A>, b: Expr<B>): Expr<[A, B]>;
  <A, B, C>(a: Expr<A>, b: Expr<B>, c: Expr<C>): Expr<[A, B, C]>;
  <A, B, C, D>(a: Expr<A>, b: Expr<B>, c: Expr<C>, d: Expr<D>): Expr<[A, B, C, D]>;
  (...exprs: Expr<any>[]): Expr<any[]>;

  // Map form: $.par(collection, opts, fn) — bounded concurrency over collection
  <T, R>(
    collection: Expr<T[]>,
    opts: { concurrency: number },
    fn: (item: Expr<T>) => Expr<R>,
  ): Expr<R[]>;
}

// ---- Plugin implementation --------------------------------

/**
 * Concurrency plugin. Namespace: `fiber/`.
 *
 * Provides `par` for parallel execution, `seq` for sequential execution,
 * `race` for first-to-complete, `timeout`, and `retry` combinators.
 */
export const fiber: PluginDefinition<FiberMethods> = {
  name: "fiber",
  nodeKinds: ["fiber/par_map", "fiber/race", "fiber/timeout", "fiber/retry"],

  build(ctx: PluginContext): FiberMethods {
    const parFn: ParFn = ((...args: any[]) => {
      // Detect which form: tuple or map
      // Map form: first arg is Expr, second is opts object with concurrency
      if (
        args.length === 3 &&
        ctx.isExpr(args[0]) &&
        typeof args[1] === "object" &&
        !ctx.isExpr(args[1]) &&
        "concurrency" in args[1] &&
        typeof args[2] === "function"
      ) {
        const [collection, opts, fn] = args;
        // Build the lambda: invoke fn with a param proxy
        const paramNode: ASTNode = {
          kind: "core/lambda_param",
          name: "par_item",
        };
        const paramProxy = ctx.expr(paramNode);
        const bodyResult = fn(paramProxy);
        const bodyNode = ctx.isExpr(bodyResult) ? bodyResult.__node : ctx.lift(bodyResult).__node;

        return ctx.expr({
          kind: "fiber/par_map",
          collection: collection.__node,
          concurrency: opts.concurrency,
          param: paramNode,
          body: bodyNode,
        });
      }

      // Tuple form: $.par(a, b, c)
      return ctx.expr({
        kind: "core/tuple",
        elements: args.map((a: any) => (ctx.isExpr(a) ? a.__node : ctx.lift(a).__node)),
      });
    }) as ParFn;

    return {
      par: parFn,

      seq(...exprs: (Expr<any> | any)[]) {
        const nodes = exprs.map((e) => (ctx.isExpr(e) ? e.__node : ctx.lift(e).__node));
        const steps = nodes.slice(0, -1);
        const result = nodes[nodes.length - 1];
        return ctx.expr({
          kind: "core/do",
          steps,
          result,
        });
      },

      race(...exprs: Expr<any>[]) {
        return ctx.expr({
          kind: "fiber/race",
          branches: exprs.map((e) => e.__node),
        });
      },

      timeout(expr, ms, fallback) {
        return ctx.expr({
          kind: "fiber/timeout",
          expr: expr.__node,
          ms: ctx.isExpr(ms) ? (ms as Expr<number>).__node : { kind: "core/literal", value: ms },
          fallback: ctx.isExpr(fallback) ? fallback.__node : ctx.lift(fallback).__node,
        });
      },

      retry(expr, opts) {
        return ctx.expr({
          kind: "fiber/retry",
          expr: expr.__node,
          attempts: opts.attempts,
          delay: opts.delay ?? 0,
        });
      },
    };
  },
};
