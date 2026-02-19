/**
 * DAG-model interpreter for eq/* node kinds.
 *
 * Child layout:
 * - eq/neq: child 0 = inner eq result (boolean), negated
 */

import type { Interpreter } from "../../dag/fold";

/** Create the eq plugin interpreter for fold(). */
export function createEqDagInterpreter(): Interpreter {
  return {
    "eq/neq": async function* () {
      return !((yield 0) as boolean);
    },
  };
}
