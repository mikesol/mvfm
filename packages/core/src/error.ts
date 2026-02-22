/**
 * Error plugin — try/catch, fail, guard for error handling.
 *
 * Uses a closure-scoped error stack so that error/caught nodes
 * can access the current error value without recurseScoped.
 */

import { makeCExpr } from "./expr";
import type { Interpreter, Plugin } from "./plugin";

// ─── error plugin ───────────────────────────────────────────────────

/** Error plugin: try/catch, fail, guard for error handling in the DSL. */
export const error: Plugin = {
  name: "error",
  ctors: {
    try: (expr: unknown) => ({
      catch: (fn: (err: unknown) => unknown) => {
        const errParam = makeCExpr("error/caught", []);
        const catchBody = fn(errParam);
        return makeCExpr("error/try", [expr, catchBody]);
      },
    }),
    fail: (msg: unknown) => makeCExpr("error/fail", [msg]),
    guard: (cond: unknown, msg: unknown) => makeCExpr("error/guard", [cond, msg]),
  },
  kinds: {},
  traits: {},
  lifts: {},
  nodeKinds: ["error/try", "error/fail", "error/guard", "error/caught"],
  defaultInterpreter: (): Interpreter => {
    const errorStack: unknown[] = [];
    return {
      "error/try": async function* () {
        try {
          return yield 0;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errorStack.push(msg);
          try {
            return yield 1;
          } finally {
            errorStack.pop();
          }
        }
      },
      "error/caught": async function* () {
        return errorStack[errorStack.length - 1];
      },
      "error/fail": async function* () {
        const msg = yield 0;
        throw new Error(String(msg));
      },
      "error/guard": async function* () {
        const cond = yield 0;
        if (!cond) {
          const msg = yield 1;
          throw new Error(String(msg));
        }
        return cond;
      },
    };
  },
};
