/**
 * DAG-model interpreter for num/* node kinds.
 *
 * Uses positional child indices (yield 0, yield 1, etc.)
 * compatible with the fold() trampoline evaluator.
 */

import type { Interpreter } from "../../dag/fold";

/** Create the num plugin interpreter for fold(). */
export function createNumDagInterpreter(): Interpreter {
  return {
    "num/add": async function* () {
      return ((yield 0) as number) + ((yield 1) as number);
    },
    "num/sub": async function* () {
      return ((yield 0) as number) - ((yield 1) as number);
    },
    "num/mul": async function* () {
      return ((yield 0) as number) * ((yield 1) as number);
    },
    "num/div": async function* () {
      return ((yield 0) as number) / ((yield 1) as number);
    },
    "num/mod": async function* () {
      return ((yield 0) as number) % ((yield 1) as number);
    },
    "num/compare": async function* () {
      const l = (yield 0) as number;
      const r = (yield 1) as number;
      return l < r ? -1 : l === r ? 0 : 1;
    },
    "num/neg": async function* () {
      return -((yield 0) as number);
    },
    "num/abs": async function* () {
      return Math.abs((yield 0) as number);
    },
    "num/floor": async function* () {
      return Math.floor((yield 0) as number);
    },
    "num/ceil": async function* () {
      return Math.ceil((yield 0) as number);
    },
    "num/round": async function* () {
      return Math.round((yield 0) as number);
    },
    "num/min": async function* (entry) {
      const values: number[] = [];
      for (let i = 0; i < entry.children.length; i++) {
        values.push((yield i) as number);
      }
      return Math.min(...values);
    },
    "num/max": async function* (entry) {
      const values: number[] = [];
      for (let i = 0; i < entry.children.length; i++) {
        values.push((yield i) as number);
      }
      return Math.max(...values);
    },
    "num/eq": async function* () {
      return ((yield 0) as number) === ((yield 1) as number);
    },
    "num/zero": async function* () {
      return 0;
    },
    "num/one": async function* () {
      return 1;
    },
    "num/show": async function* () {
      return String((yield 0) as number);
    },
    "num/top": async function* () {
      return Infinity;
    },
    "num/bottom": async function* () {
      return -Infinity;
    },
  };
}
