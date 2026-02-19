/**
 * DAG-model interpreter for ord/* node kinds.
 *
 * Child layout:
 * - ord/gt, ord/gte, ord/lt, ord/lte: child 0 = compare result (number)
 *   The compare result is a three-way comparison (-1, 0, 1).
 *   These derive boolean results from it.
 */

import type { Interpreter } from "../../dag/fold";

/** Create the ord plugin interpreter for fold(). */
export function createOrdDagInterpreter(): Interpreter {
  return {
    "ord/gt": async function* () {
      return ((yield 0) as number) > 0;
    },
    "ord/gte": async function* () {
      return ((yield 0) as number) >= 0;
    },
    "ord/lt": async function* () {
      return ((yield 0) as number) < 0;
    },
    "ord/lte": async function* () {
      return ((yield 0) as number) <= 0;
    },
  };
}
