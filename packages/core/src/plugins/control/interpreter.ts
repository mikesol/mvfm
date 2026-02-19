/**
 * DAG-model interpreter for control/* node kinds.
 *
 * Child layout:
 * - control/each: child 0 = collection, children[1..N-1] = body statements
 *   Each body statement is yielded with the current item in scope.
 * - control/while: child 0 = condition, children[1..N-1] = body statements
 *   Condition is re-evaluated each iteration (volatile-aware via taint).
 */

import type { Interpreter } from "../../dag/fold";

/** Create the control plugin interpreter for fold(). */
export function createControlDagInterpreter(): Interpreter {
  return {
    "control/each": async function* (entry) {
      const collection = (yield 0) as unknown[];
      for (const item of collection) {
        for (let i = 1; i < entry.children.length; i++) {
          yield { child: i, scope: { __item: item } };
        }
      }
      return undefined;
    },
    "control/while": async function* (entry) {
      while ((yield 0) as boolean) {
        for (let i = 1; i < entry.children.length; i++) {
          yield i;
        }
      }
      return undefined;
    },
  };
}
