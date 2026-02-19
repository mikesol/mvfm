/**
 * DAG-model interpreter for error/* node kinds.
 *
 * Child layout:
 * - error/fail: child 0 = error value, throws it
 * - error/try: child 0 = expr, child 1 = catch body (optional)
 * - error/attempt: child 0 = expr, returns {ok, err}
 * - error/guard: child 0 = condition, child 1 = error value
 * - error/settle: children[0..N-1] = expressions to settle
 */

import type { Interpreter } from "../../dag/fold";

/** Create the error plugin interpreter for fold(). */
export function createErrorDagInterpreter(): Interpreter {
  return {
    "error/fail": async function* () {
      const error = yield 0;
      throw error;
    },
    "error/try": async function* (entry) {
      try {
        return yield 0;
      } catch (e) {
        if (entry.children.length > 1) {
          // child 1 is the catch body — yield it with error in scope
          return yield { child: 1, scope: { __error: e } };
        }
        throw e;
      }
    },
    "error/attempt": async function* () {
      try {
        const ok = yield 0;
        return { ok, err: null };
      } catch (e) {
        return { ok: null, err: e };
      }
    },
    "error/guard": async function* () {
      const condition = (yield 0) as boolean;
      if (!condition) {
        const error = yield 1;
        throw error;
      }
      return undefined;
    },
    "error/settle": async function* (entry) {
      const fulfilled: unknown[] = [];
      const rejected: unknown[] = [];
      for (let i = 0; i < entry.children.length; i++) {
        try {
          fulfilled.push(yield i);
        } catch (e) {
          rejected.push(e);
        }
      }
      return { fulfilled, rejected };
    },
  };
}
