/**
 * DAG-model interpreter for fiber/* node kinds.
 *
 * Child layout:
 * - fiber/par: children[0..N-1] = parallel branches (sequential default)
 * - fiber/race: children[0..N-1] = race branches (returns first, sequential)
 * - fiber/seq: children[0..N-1] = sequential steps (returns last)
 *
 * The default interpreter evaluates sequentially. True parallel
 * execution would require a factory that receives the full adj map.
 */

import type { Interpreter } from "../../dag/fold";

/** Create the fiber plugin interpreter for fold(). */
export function createFiberDagInterpreter(): Interpreter {
  return {
    "fiber/par": async function* (entry) {
      const results: unknown[] = [];
      for (let i = 0; i < entry.children.length; i++) {
        results.push(yield i);
      }
      return results;
    },
    "fiber/race": async function* (entry) {
      if (entry.children.length === 0) {
        throw new Error("fiber/race: no branches");
      }
      // Sequential: return first branch result
      return yield 0;
    },
    "fiber/seq": async function* (entry) {
      let last: unknown;
      for (let i = 0; i < entry.children.length; i++) {
        last = yield i;
      }
      return last;
    },
  };
}
