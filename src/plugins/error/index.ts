// ============================================================
// ILO PLUGIN: error — structured error handling
// ============================================================
//
// This plugin provides error handling as first-class AST nodes.
// Like fiber, it doesn't know about postgres or any specific
// effect — it works with any Expr<T>.
//
// DESIGN:
//
// In real JS, errors are implicit. Any function can throw.
// In Ilo, errors are explicit. A program that might fail
// says so in its AST. This is the Either monad, but surfaced
// as simple combinators.
//
// DEFAULT BEHAVIOR (no error plugin):
//   If a query fails, the whole program fails.
//   The interpreter catches it and returns an error response.
//   This is fine for 80% of cases.
//
// WITH error plugin:
//   You can catch failures locally and provide fallbacks.
//   You can match on error types.
//   You can accumulate errors from parallel branches.
//   The error handling strategy is in the AST and verifiable.
//
// MONAD STACK:
//   core (Identity) → fiber (Aff) → error (ExceptT)
//   But the developer never sees this. The proxy hides
//   all lifting/unwrapping. You just write $.try().
//
// ============================================================

import type { ASTNode, Expr, PluginContext, PluginDefinition } from "../../core";

// ---- What the plugin adds to $ ----------------------------

/**
 * Structured error handling operations added to the DSL context.
 *
 * Provides try/catch, fail, orElse, attempt, guard, and settle
 * combinators for explicit, AST-level error handling.
 */
export interface ErrorMethods {
  /**
   * Attempt an expression that might fail.
   * Returns a builder with `.catch()` and `.finally()`.
   *
   * ```
   * $.try($.sql`select * from users where id = ${id}`)
   *   .catch(err => ({ error: err.message, data: null }))
   * ```
   *
   * Without `.catch()`, an unhandled failure propagates up
   * (equivalent to re-throwing). The `.catch()` provides
   * the recovery branch.
   */
  try<T>(expr: Expr<T>): TryBuilder<T>;

  /**
   * Explicitly fail with an error value.
   * This is `throw` for the DSL.
   *
   * ```
   * $.cond($.eq(user, null))
   *   .t($.fail({ code: 404, message: 'not found' }))
   *   .f(user)
   * ```
   */
  fail(error: Expr<any> | any): Expr<never>;

  /**
   * Unwrap an attempted expression, providing a default
   * on failure. Sugar for `$.try(expr).catch(() => default)`.
   *
   * ```
   * const user = $.orElse(
   *   $.sql`select * from users where id = ${id}`,
   *   { name: 'anonymous', id: 0 }
   * )
   * ```
   */
  orElse<T>(expr: Expr<T>, fallback: Expr<T> | T): Expr<T>;

  /**
   * Attempt an expression and return an Either-style result.
   * The result has `.ok` and `.err` properties.
   *
   * ```
   * const result = $.attempt(
   *   $.sql`select * from users where id = ${id}`
   * )
   * // result.ok  — Expr<T | null>  (null if failed)
   * // result.err — Expr<Error | null> (null if succeeded)
   *
   * return $.cond($.eq(result.err, null))
   *   .t(transform(result.ok))
   *   .f({ error: result.err })
   * ```
   */
  attempt<T>(expr: Expr<T>): Expr<{ ok: T | null; err: any | null }>;

  /**
   * Validate a condition, failing if it's false.
   * Like an assertion in the program.
   *
   * ```
   * $.guard($.gt(user.age, 18), { code: 403, message: 'must be 18+' })
   * ```
   *
   * If the condition is true, continues. If false, fails
   * with the given error. Useful in `$.do()` chains:
   *
   * ```
   * return $.do(
   *   $.guard($.gt(balance, amount), 'insufficient funds'),
   *   $.sql`update accounts set balance = balance - ${amount}`,
   *   { success: true }
   * )
   * ```
   */
  guard(condition: Expr<boolean>, error: Expr<any> | any): Expr<void>;

  /**
   * Collect results from multiple expressions, accumulating
   * both successes and failures instead of failing fast.
   *
   * ```
   * const results = $.settle(
   *   $.sql`select * from service_a`,
   *   $.sql`select * from service_b`,
   *   $.sql`select * from service_c`
   * )
   * // results.fulfilled — array of successful values
   * // results.rejected  — array of errors
   * ```
   *
   * This is `Promise.allSettled` for the DSL.
   */
  settle(...exprs: Expr<any>[]): Expr<{
    fulfilled: any[];
    rejected: any[];
  }>;
}

// ---- TryBuilder: fluent error handling --------------------

interface TryBuilder<T> {
  /**
   * Provide a recovery function for failures.
   *
   * ```
   * $.try(riskyQuery)
   *   .catch(err => fallbackValue)
   * ```
   *
   * The `err` parameter is an Expr representing the error.
   * The callback returns the recovery value.
   */
  catch<U>(fn: (err: Expr<any>) => Expr<U> | U): Expr<T | U>;

  /**
   * Match on specific error shapes.
   *
   * ```
   * $.try(riskyQuery)
   *   .match({
   *     'not_found': (err) => defaultUser,
   *     'timeout':   (err) => cachedUser,
   *     '_':         (err) => $.fail(err)  // re-throw
   *   })
   * ```
   */
  match<U>(cases: Record<string, (err: Expr<any>) => Expr<U> | U>): Expr<T | U>;

  /**
   * Run a cleanup action regardless of success or failure.
   * The cleanup expression is always executed but its result
   * is discarded -- the try result (or catch result) is returned.
   *
   * ```
   * $.try(riskyQuery)
   *   .catch(err => fallback)
   *   .finally($.sql`update audit_log set ...`)
   * ```
   */
  finally(cleanup: Expr<any>): TryBuilder<T>;
}

// ---- Plugin implementation --------------------------------

/**
 * Error handling plugin. Namespace: `error/`.
 *
 * Makes failures explicit in the AST via try/catch, fail, attempt,
 * guard, and settle combinators.
 */
export const error: PluginDefinition<ErrorMethods> = {
  name: "error",
  nodeKinds: ["error/try", "error/fail", "error/attempt", "error/guard", "error/settle"],

  build(ctx: PluginContext): ErrorMethods {
    function buildTryBuilder<T>(
      exprNode: ASTNode,
      finallyNode: ASTNode | null = null,
    ): TryBuilder<T> {
      return {
        catch<U>(fn: (err: Expr<any>) => Expr<U> | U): Expr<T | U> {
          const errParam: ASTNode = {
            kind: "core/lambda_param",
            name: "err",
          };
          const errProxy = ctx.expr<any>(errParam);
          const recoveryResult = fn(errProxy);
          const recoveryNode = ctx.isExpr(recoveryResult)
            ? recoveryResult.__node
            : ctx.lift(recoveryResult).__node;

          return ctx.expr<T | U>({
            kind: "error/try",
            expr: exprNode,
            catch: {
              param: errParam,
              body: recoveryNode,
            },
            finally: finallyNode,
          });
        },

        match<U>(cases: Record<string, (err: Expr<any>) => Expr<U> | U>): Expr<T | U> {
          const errParam: ASTNode = {
            kind: "core/lambda_param",
            name: "err",
          };
          const errProxy = ctx.expr<any>(errParam);

          const branches: Record<string, ASTNode> = {};
          for (const [key, fn] of Object.entries(cases)) {
            const result = fn(errProxy);
            branches[key] = ctx.isExpr(result) ? result.__node : ctx.lift(result).__node;
          }

          return ctx.expr<T | U>({
            kind: "error/try",
            expr: exprNode,
            match: {
              param: errParam,
              branches,
            },
            finally: finallyNode,
          });
        },

        finally(cleanup: Expr<any>): TryBuilder<T> {
          return buildTryBuilder<T>(exprNode, cleanup.__node);
        },
      };
    }

    return {
      try<T>(expr: Expr<T>): TryBuilder<T> {
        return buildTryBuilder<T>(expr.__node);
      },

      fail(error: Expr<any> | any): Expr<never> {
        return ctx.expr<never>({
          kind: "error/fail",
          error: ctx.isExpr(error) ? error.__node : ctx.lift(error).__node,
        });
      },

      orElse<T>(expr: Expr<T>, fallback: Expr<T> | T): Expr<T> {
        const fallbackNode = ctx.isExpr(fallback) ? fallback.__node : ctx.lift(fallback).__node;

        // Sugar: desugars to try/catch that ignores the error
        return ctx.expr<T>({
          kind: "error/try",
          expr: expr.__node,
          catch: {
            param: { kind: "core/lambda_param", name: "_err" },
            body: fallbackNode,
          },
          finally: null,
        });
      },

      attempt<T>(expr: Expr<T>): Expr<{ ok: T | null; err: any | null }> {
        return ctx.expr({
          kind: "error/attempt",
          expr: expr.__node,
        });
      },

      guard(condition: Expr<boolean>, error: Expr<any> | any): Expr<void> {
        return ctx.expr<void>({
          kind: "error/guard",
          condition: condition.__node,
          error: ctx.isExpr(error) ? error.__node : ctx.lift(error).__node,
        });
      },

      settle(...exprs: Expr<any>[]) {
        return ctx.expr({
          kind: "error/settle",
          exprs: exprs.map((e) => e.__node),
        });
      },
    };
  },
};
