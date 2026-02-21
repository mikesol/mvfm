import { describe, expect, test } from "vitest";
import { fold, type Interpreter, type RuntimeEntry } from "../../src/index";

// State cell pattern: mutable state via closures in handlers.
// st/let creates a cell, st/get reads it, st/set writes it.
function makeStInterp() {
  const cells: Record<string, { value: unknown }> = {};
  const interp: Interpreter = {
    "num/literal": async function* (e) {
      return e.out;
    },
    "st/let": async function* (entry) {
      const initial = yield 0;
      cells[entry.children[0]] = { value: initial };
      return yield 1;
    },
    "st/get": async function* (entry) {
      return cells[entry.out as string]?.value;
    },
    "st/set": async function* (entry) {
      const newVal = yield 0;
      cells[entry.out as string] = { value: newVal };
      return newVal;
    },
    "st/seq": async function* (entry) {
      let last: unknown;
      for (let i = 0; i < entry.children.length; i++) last = yield i;
      return last;
    },
    "st/push": async function* (entry) {
      const item = yield 0;
      const arr = cells[entry.out as string]?.value as unknown[];
      arr.push(item);
      return arr;
    },
    "bool/literal": async function* (e) {
      return e.out;
    },
    "core/cond": async function* () {
      const pred = (yield 0) as boolean;
      return pred ? yield 1 : yield 2;
    },
  };
  return { interp, cells };
}

describe("state management golden tests", () => {
  describe("basic state via closures", () => {
    test("let(5) -> get returns 5", async () => {
      const { interp } = makeStInterp();
      const adj: Record<string, RuntimeEntry> = {
        v: { kind: "num/literal", children: [], out: 5 },
        g: { kind: "st/get", children: [], out: "v" },
        root: { kind: "st/let", children: ["v", "g"], out: undefined },
      };
      expect(await fold<number>("root", adj, interp)).toBe(5);
    });

    test("let(5) -> set(10) -> get returns 10", async () => {
      const { interp } = makeStInterp();
      const adj: Record<string, RuntimeEntry> = {
        init: { kind: "num/literal", children: [], out: 5 },
        ten: { kind: "num/literal", children: [], out: 10 },
        s: { kind: "st/set", children: ["ten"], out: "init" },
        g: { kind: "st/get", children: [], out: "init" },
        body: { kind: "st/seq", children: ["s", "g"], out: undefined },
        root: { kind: "st/let", children: ["init", "body"], out: undefined },
      };
      expect(await fold<number>("root", adj, interp)).toBe(10);
    });

    test("multiple let bindings are independent cells", async () => {
      const { interp } = makeStInterp();
      const adj: Record<string, RuntimeEntry> = {
        three: { kind: "num/literal", children: [], out: 3 },
        seven: { kind: "num/literal", children: [], out: 7 },
        gx: { kind: "st/get", children: [], out: "three" },
        gy: { kind: "st/get", children: [], out: "seven" },
        innerBody: { kind: "st/seq", children: ["gx", "gy"], out: undefined },
        inner: { kind: "st/let", children: ["seven", "innerBody"], out: undefined },
        root: { kind: "st/let", children: ["three", "inner"], out: undefined },
      };
      expect(await fold<number>("root", adj, interp)).toBe(7);
    });

    test("state persists through sequence (begin pattern)", async () => {
      const { interp } = makeStInterp();
      const adj: Record<string, RuntimeEntry> = {
        one: { kind: "num/literal", children: [], out: 1 },
        two: { kind: "num/literal", children: [], out: 2 },
        thr: { kind: "num/literal", children: [], out: 3 },
        s1: { kind: "st/set", children: ["two"], out: "one" },
        s2: { kind: "st/set", children: ["thr"], out: "one" },
        g: { kind: "st/get", children: [], out: "one" },
        body: { kind: "st/seq", children: ["s1", "s2", "g"], out: undefined },
        root: { kind: "st/let", children: ["one", "body"], out: undefined },
      };
      expect(await fold<number>("root", adj, interp)).toBe(3);
    });

    test("get without prior set returns initial value", async () => {
      const { interp } = makeStInterp();
      const adj: Record<string, RuntimeEntry> = {
        init: { kind: "num/literal", children: [], out: 42 },
        g: { kind: "st/get", children: [], out: "init" },
        root: { kind: "st/let", children: ["init", "g"], out: undefined },
      };
      expect(await fold<number>("root", adj, interp)).toBe(42);
    });
  });

  describe("push to array", () => {
    test("push adds item to array cell", async () => {
      const { interp, cells } = makeStInterp();
      cells.arr = { value: [1, 2] };
      const adj: Record<string, RuntimeEntry> = {
        item: { kind: "num/literal", children: [], out: 3 },
        p: { kind: "st/push", children: ["item"], out: "arr" },
      };
      expect(await fold<number[]>("p", adj, interp)).toEqual([1, 2, 3]);
    });

    test("multiple pushes accumulate", async () => {
      const { interp, cells } = makeStInterp();
      cells.arr = { value: [] as number[] };
      const adj: Record<string, RuntimeEntry> = {
        a: { kind: "num/literal", children: [], out: 10 },
        b: { kind: "num/literal", children: [], out: 20 },
        c: { kind: "num/literal", children: [], out: 30 },
        p1: { kind: "st/push", children: ["a"], out: "arr" },
        p2: { kind: "st/push", children: ["b"], out: "arr" },
        p3: { kind: "st/push", children: ["c"], out: "arr" },
        seq: { kind: "st/seq", children: ["p1", "p2", "p3"], out: undefined },
      };
      await fold<unknown>("seq", adj, interp);
      expect(cells.arr.value).toEqual([10, 20, 30]);
    });

    test("push returns updated array", async () => {
      const { interp, cells } = makeStInterp();
      cells.arr = { value: ["x"] };
      const adj: Record<string, RuntimeEntry> = {
        item: { kind: "num/literal", children: [], out: 99 },
        p: { kind: "st/push", children: ["item"], out: "arr" },
      };
      expect(await fold<unknown[]>("p", adj, interp)).toEqual(["x", 99]);
    });
  });

  describe("state with control flow", () => {
    test("set inside cond true branch", async () => {
      const { interp } = makeStInterp();
      const adj: Record<string, RuntimeEntry> = {
        zero: { kind: "num/literal", children: [], out: 0 },
        v42: { kind: "num/literal", children: [], out: 42 },
        v99: { kind: "num/literal", children: [], out: 99 },
        flag: { kind: "bool/literal", children: [], out: true },
        st: { kind: "st/set", children: ["v42"], out: "zero" },
        sf: { kind: "st/set", children: ["v99"], out: "zero" },
        cnd: { kind: "core/cond", children: ["flag", "st", "sf"], out: undefined },
        g: { kind: "st/get", children: [], out: "zero" },
        body: { kind: "st/seq", children: ["cnd", "g"], out: undefined },
        root: { kind: "st/let", children: ["zero", "body"], out: undefined },
      };
      expect(await fold<number>("root", adj, interp)).toBe(42);
    });

    test("set inside cond false branch", async () => {
      const { interp } = makeStInterp();
      const adj: Record<string, RuntimeEntry> = {
        zero: { kind: "num/literal", children: [], out: 0 },
        v42: { kind: "num/literal", children: [], out: 42 },
        v99: { kind: "num/literal", children: [], out: 99 },
        flag: { kind: "bool/literal", children: [], out: false },
        st: { kind: "st/set", children: ["v42"], out: "zero" },
        sf: { kind: "st/set", children: ["v99"], out: "zero" },
        cnd: { kind: "core/cond", children: ["flag", "st", "sf"], out: undefined },
        g: { kind: "st/get", children: [], out: "zero" },
        body: { kind: "st/seq", children: ["cnd", "g"], out: undefined },
        root: { kind: "st/let", children: ["zero", "body"], out: undefined },
      };
      expect(await fold<number>("root", adj, interp)).toBe(99);
    });

    test("state read after conditional preserves mutation", async () => {
      const { interp } = makeStInterp();
      const adj: Record<string, RuntimeEntry> = {
        one: { kind: "num/literal", children: [], out: 1 },
        hun: { kind: "num/literal", children: [], out: 100 },
        noop: { kind: "num/literal", children: [], out: -1 },
        flag: { kind: "bool/literal", children: [], out: true },
        s: { kind: "st/set", children: ["hun"], out: "one" },
        cnd: { kind: "core/cond", children: ["flag", "s", "noop"], out: undefined },
        g: { kind: "st/get", children: [], out: "one" },
        body: { kind: "st/seq", children: ["cnd", "g"], out: undefined },
        root: { kind: "st/let", children: ["one", "body"], out: undefined },
      };
      expect(await fold<number>("root", adj, interp)).toBe(100);
    });
  });

  // Volatile behavior: production fold skips memoization for st/get nodes.
  // The koan fold memoizes ALL nodes. These tests document expected behavior.
  describe("volatile behavior documentation", () => {
    test("same get node is memoized (koan fold limitation)", async () => {
      // Two seq steps yield the same st/get "g", but fold memoizes it.
      // Production fold with VOLATILE_KINDS would re-evaluate, returning 5.
      const { interp } = makeStInterp();
      const adj: Record<string, RuntimeEntry> = {
        init: { kind: "num/literal", children: [], out: 0 },
        five: { kind: "num/literal", children: [], out: 5 },
        g: { kind: "st/get", children: [], out: "init" },
        s: { kind: "st/set", children: ["five"], out: "init" },
        body: { kind: "st/seq", children: ["g", "s", "g"], out: undefined },
        root: { kind: "st/let", children: ["init", "body"], out: undefined },
      };
      // Koan fold: memoized stale value. Production volatile fold: 5.
      expect(await fold<number>("root", adj, interp)).toBe(0);
    });

    test("distinct get nodes avoid memoization issue", async () => {
      const { interp } = makeStInterp();
      const adj: Record<string, RuntimeEntry> = {
        init: { kind: "num/literal", children: [], out: 0 },
        five: { kind: "num/literal", children: [], out: 5 },
        g1: { kind: "st/get", children: [], out: "init" },
        g2: { kind: "st/get", children: [], out: "init" },
        s: { kind: "st/set", children: ["five"], out: "init" },
        body: { kind: "st/seq", children: ["g1", "s", "g2"], out: undefined },
        root: { kind: "st/let", children: ["init", "body"], out: undefined },
      };
      expect(await fold<number>("root", adj, interp)).toBe(5);
    });

    test("end-to-end state pattern with sequential evaluation", async () => {
      const { interp } = makeStInterp();
      const adj: Record<string, RuntimeEntry> = {
        init: { kind: "num/literal", children: [], out: 0 },
        v1: { kind: "num/literal", children: [], out: 10 },
        v2: { kind: "num/literal", children: [], out: 20 },
        s1: { kind: "st/set", children: ["v1"], out: "init" },
        s2: { kind: "st/set", children: ["v2"], out: "init" },
        g: { kind: "st/get", children: [], out: "init" },
        body: { kind: "st/seq", children: ["s1", "s2", "g"], out: undefined },
        root: { kind: "st/let", children: ["init", "body"], out: undefined },
      };
      expect(await fold<number>("root", adj, interp)).toBe(20);
    });

    test("interleaved set/get with distinct nodes works correctly", async () => {
      // Documents EXPECTED production behavior with distinct nodes.
      // When VOLATILE_KINDS includes "st/get", fold will NOT memoize
      // st/get nodes and re-run handlers on each yield.
      const { interp } = makeStInterp();
      const adj: Record<string, RuntimeEntry> = {
        init: { kind: "num/literal", children: [], out: 1 },
        v2: { kind: "num/literal", children: [], out: 2 },
        v3: { kind: "num/literal", children: [], out: 3 },
        s1: { kind: "st/set", children: ["v2"], out: "init" },
        g1: { kind: "st/get", children: [], out: "init" },
        s2: { kind: "st/set", children: ["v3"], out: "init" },
        g2: { kind: "st/get", children: [], out: "init" },
        body: { kind: "st/seq", children: ["s1", "g1", "s2", "g2"], out: undefined },
        root: { kind: "st/let", children: ["init", "body"], out: undefined },
      };
      expect(await fold<number>("root", adj, interp)).toBe(3);
    });
  });
});
