/**
 * DAG-model interpreter for boolean/* node kinds.
 *
 * Child layout per kind:
 * - boolean/and: child 0 = left, child 1 = right (short-circuits)
 * - boolean/or: child 0 = left, child 1 = right (short-circuits)
 * - boolean/not: child 0 = operand
 * - boolean/eq: child 0 = left, child 1 = right
 * - boolean/ff: leaf, returns false
 * - boolean/tt: leaf, returns true
 * - boolean/implies: child 0 = left, child 1 = right
 * - boolean/show: child 0 = operand
 * - boolean/top: leaf, returns true
 * - boolean/bottom: leaf, returns false
 */

import type { Interpreter } from "../../dag/fold";

/** Create the boolean plugin interpreter for fold(). */
export function createBooleanDagInterpreter(): Interpreter {
  return {
    "boolean/and": async function* () {
      const left = (yield 0) as boolean;
      return left ? yield 1 : false;
    },
    "boolean/or": async function* () {
      const left = (yield 0) as boolean;
      return left ? true : yield 1;
    },
    "boolean/not": async function* () {
      return !((yield 0) as boolean);
    },
    "boolean/eq": async function* () {
      return ((yield 0) as boolean) === ((yield 1) as boolean);
    },
    "boolean/ff": async function* () {
      return false;
    },
    "boolean/tt": async function* () {
      return true;
    },
    "boolean/implies": async function* () {
      const left = (yield 0) as boolean;
      return !left ? true : yield 1;
    },
    "boolean/show": async function* () {
      return String(yield 0);
    },
    "boolean/top": async function* () {
      return true;
    },
    "boolean/bottom": async function* () {
      return false;
    },
  };
}
