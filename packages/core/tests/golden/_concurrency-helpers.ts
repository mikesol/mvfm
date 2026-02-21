/**
 * Shared interpreters and helpers for concurrency golden tests.
 */
import { fold, type Interpreter, type RuntimeEntry } from "../../src/index";

export { fold, type RuntimeEntry, type Interpreter };

// ─── Base num interpreter ────────────────────────────────────────────
export const numInterp: Interpreter = {
  "num/literal": async function* (entry) {
    return entry.out as number;
  },
  "num/add": async function* () {
    return ((yield 0) as number) + ((yield 1) as number);
  },
  "num/mul": async function* () {
    return ((yield 0) as number) * ((yield 1) as number);
  },
};

// ─── Par handler: evaluates all children, returns array ─────────────
export function parHandler(): Interpreter {
  return {
    "fiber/par": async function* (entry) {
      const results: unknown[] = [];
      for (let i = 0; i < entry.children.length; i++) {
        results.push(yield i);
      }
      return results;
    },
  };
}

// ─── Seq handler: evaluates all children, returns last ──────────────
export function seqHandler(): Interpreter {
  return {
    "fiber/seq": async function* (entry) {
      let last: unknown;
      for (let i = 0; i < entry.children.length; i++) {
        last = yield i;
      }
      return last;
    },
  };
}

// ─── Counting num interpreter for memoization tests ─────────────────
export function countingNumInterp(counter: { value: number }): Interpreter {
  return {
    "num/literal": async function* (entry) {
      counter.value++;
      return entry.out as number;
    },
    "num/add": async function* () {
      return ((yield 0) as number) + ((yield 1) as number);
    },
    "num/mul": async function* () {
      return ((yield 0) as number) * ((yield 1) as number);
    },
  };
}
