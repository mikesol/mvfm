import { describe, expect, test } from "vitest";
import {
  countingNumInterp,
  fold,
  type Interpreter,
  numInterp,
  parHandler,
  type RuntimeEntry,
  seqHandler,
} from "./_concurrency-helpers";

describe("concurrency golden tests", () => {
  // ═══════════════════════════════════════════════════════════════════
  // PARALLEL EXECUTION
  // ═══════════════════════════════════════════════════════════════════
  describe("parallel execution (fiber/par)", () => {
    const parInterp: Interpreter = { ...numInterp, ...parHandler() };

    test("par with 2 children returns [10, 20]", async () => {
      const adj: Record<string, RuntimeEntry> = {
        a: { kind: "num/literal", children: [], out: 10 },
        b: { kind: "num/literal", children: [], out: 20 },
        p: { kind: "fiber/par", children: ["a", "b"], out: undefined },
      };
      expect(await fold<number[]>("p", adj, parInterp)).toEqual([10, 20]);
    });

    test("par with 3 children returns [1, 2, 3]", async () => {
      const adj: Record<string, RuntimeEntry> = {
        a: { kind: "num/literal", children: [], out: 1 },
        b: { kind: "num/literal", children: [], out: 2 },
        c: { kind: "num/literal", children: [], out: 3 },
        p: { kind: "fiber/par", children: ["a", "b", "c"], out: undefined },
      };
      expect(await fold<number[]>("p", adj, parInterp)).toEqual([1, 2, 3]);
    });

    test("par with nested arithmetic children", async () => {
      const adj: Record<string, RuntimeEntry> = {
        a: { kind: "num/literal", children: [], out: 3 },
        b: { kind: "num/literal", children: [], out: 4 },
        c: { kind: "num/add", children: ["a", "b"], out: undefined },
        d: { kind: "num/literal", children: [], out: 10 },
        p: { kind: "fiber/par", children: ["c", "d"], out: undefined },
      };
      expect(await fold<unknown[]>("p", adj, parInterp)).toEqual([7, 10]);
    });

    test("par with single child returns [value]", async () => {
      const adj: Record<string, RuntimeEntry> = {
        a: { kind: "num/literal", children: [], out: 42 },
        p: { kind: "fiber/par", children: ["a"], out: undefined },
      };
      expect(await fold<number[]>("p", adj, parInterp)).toEqual([42]);
    });

    test("par with zero children returns []", async () => {
      const adj: Record<string, RuntimeEntry> = {
        p: { kind: "fiber/par", children: [], out: undefined },
      };
      expect(await fold<unknown[]>("p", adj, parInterp)).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // SEQUENTIAL EXECUTION
  // ═══════════════════════════════════════════════════════════════════
  describe("sequential execution (fiber/seq)", () => {
    const seqInterp: Interpreter = { ...numInterp, ...seqHandler() };

    test("seq returns last value", async () => {
      const adj: Record<string, RuntimeEntry> = {
        a: { kind: "num/literal", children: [], out: 10 },
        b: { kind: "num/literal", children: [], out: 20 },
        c: { kind: "num/literal", children: [], out: 30 },
        s: { kind: "fiber/seq", children: ["a", "b", "c"], out: undefined },
      };
      expect(await fold<number>("s", adj, seqInterp)).toBe(30);
    });

    test("seq evaluates all children via side-effect counting", async () => {
      const counter = { value: 0 };
      const interp: Interpreter = {
        ...countingNumInterp(counter),
        ...seqHandler(),
      };
      const adj: Record<string, RuntimeEntry> = {
        a: { kind: "num/literal", children: [], out: 1 },
        b: { kind: "num/literal", children: [], out: 2 },
        c: { kind: "num/literal", children: [], out: 3 },
        s: { kind: "fiber/seq", children: ["a", "b", "c"], out: undefined },
      };
      await fold<number>("s", adj, interp);
      expect(counter.value).toBe(3);
    });

    test("seq with single child returns that child", async () => {
      const adj: Record<string, RuntimeEntry> = {
        a: { kind: "num/literal", children: [], out: 99 },
        s: { kind: "fiber/seq", children: ["a"], out: undefined },
      };
      expect(await fold<number>("s", adj, seqInterp)).toBe(99);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // TIMEOUT PATTERN
  // ═══════════════════════════════════════════════════════════════════
  describe("timeout pattern (fiber/timeout)", () => {
    function timeoutInterp(flagBased = false): Interpreter {
      return {
        ...numInterp,
        "fiber/timeout": async function* (entry) {
          if (flagBased) {
            const shouldFail = entry.out as boolean;
            return shouldFail ? yield 1 : yield 0;
          }
          return yield 0;
        },
      };
    }

    test("timeout with successful body returns body result", async () => {
      const adj: Record<string, RuntimeEntry> = {
        a: { kind: "num/literal", children: [], out: 42 },
        b: { kind: "num/literal", children: [], out: 0 },
        t: { kind: "fiber/timeout", children: ["a", "b"], out: undefined },
      };
      expect(await fold<number>("t", adj, timeoutInterp())).toBe(42);
    });

    test("timeout with flag-based failure returns fallback", async () => {
      const adj: Record<string, RuntimeEntry> = {
        a: { kind: "num/literal", children: [], out: 42 },
        b: { kind: "num/literal", children: [], out: -1 },
        t: { kind: "fiber/timeout", children: ["a", "b"], out: true },
      };
      expect(await fold<number>("t", adj, timeoutInterp(true))).toBe(-1);
    });

    test("timeout flag false returns body", async () => {
      const adj: Record<string, RuntimeEntry> = {
        a: { kind: "num/literal", children: [], out: 100 },
        b: { kind: "num/literal", children: [], out: -1 },
        t: { kind: "fiber/timeout", children: ["a", "b"], out: false },
      };
      expect(await fold<number>("t", adj, timeoutInterp(true))).toBe(100);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // MEMOIZATION ACROSS PAR CHILDREN
  // ═══════════════════════════════════════════════════════════════════
  describe("memoization across par children", () => {
    function memoParInterp(counter: { value: number }): Interpreter {
      return { ...countingNumInterp(counter), ...parHandler() };
    }

    test("shared node referenced by two par children evaluated once", async () => {
      const counter = { value: 0 };
      const adj: Record<string, RuntimeEntry> = {
        s: { kind: "num/literal", children: [], out: 5 },
        x: { kind: "num/add", children: ["s", "s"], out: undefined },
        p: { kind: "fiber/par", children: ["x", "x"], out: undefined },
      };
      const result = await fold<number[]>("p", adj, memoParInterp(counter));
      expect(result).toEqual([10, 10]);
      expect(counter.value).toBe(1);
    });

    test("diamond in parallel branches: shared subexpr evaluated once", async () => {
      const counter = { value: 0 };
      const adj: Record<string, RuntimeEntry> = {
        a: { kind: "num/literal", children: [], out: 3 },
        b: { kind: "num/add", children: ["a", "a"], out: undefined },
        c: { kind: "num/mul", children: ["a", "a"], out: undefined },
        p: { kind: "fiber/par", children: ["b", "c"], out: undefined },
      };
      const result = await fold<number[]>("p", adj, memoParInterp(counter));
      expect(result).toEqual([6, 9]);
      expect(counter.value).toBe(1);
    });

    test("three par children sharing a common leaf", async () => {
      const counter = { value: 0 };
      const adj: Record<string, RuntimeEntry> = {
        leaf: { kind: "num/literal", children: [], out: 7 },
        x: { kind: "num/add", children: ["leaf", "leaf"], out: undefined },
        p: { kind: "fiber/par", children: ["x", "x", "leaf"], out: undefined },
      };
      const result = await fold<unknown[]>("p", adj, memoParInterp(counter));
      expect(result).toEqual([14, 14, 7]);
      expect(counter.value).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // INDEPENDENT FOLD CALLS
  // ═══════════════════════════════════════════════════════════════════
  describe("independent fold calls", () => {
    test("independent fold from within handler returns correct result", async () => {
      const subInterp: Interpreter = {
        ...numInterp,
        "fiber/subfold": async function* () {
          const subAdj: Record<string, RuntimeEntry> = {
            x: { kind: "num/literal", children: [], out: 42 },
          };
          return await fold<number>("x", subAdj, numInterp);
        },
      };
      const adj: Record<string, RuntimeEntry> = {
        r: { kind: "fiber/subfold", children: [], out: undefined },
      };
      expect(await fold<number>("r", adj, subInterp)).toBe(42);
    });

    test("independent fold does not interfere with parent fold", async () => {
      const subInterp: Interpreter = {
        ...numInterp,
        "fiber/subfold": async function* () {
          const subAdj: Record<string, RuntimeEntry> = {
            a: { kind: "num/literal", children: [], out: 10 },
            b: { kind: "num/literal", children: [], out: 20 },
            c: { kind: "num/add", children: ["a", "b"], out: undefined },
          };
          return await fold<number>("c", subAdj, numInterp);
        },
      };
      // add(subfold(), 5) where subfold() = 30 → 35
      const adj: Record<string, RuntimeEntry> = {
        s: { kind: "fiber/subfold", children: [], out: undefined },
        n: { kind: "num/literal", children: [], out: 5 },
        r: { kind: "num/add", children: ["s", "n"], out: undefined },
      };
      expect(await fold<number>("r", adj, subInterp)).toBe(35);
    });
  });
});
