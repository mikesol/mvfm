import { describe, test, expect } from "vitest";
import {
  fold,
  type RuntimeEntry,
  type Interpreter,
} from "../../src/__koans__/16-bridge";

// ─── State cell pattern ─────────────────────────────────────────────
// Mutable state is implemented via closures in handlers. A st/let
// handler creates a mutable reference cell, and st/get / st/set
// handlers read/write it. This mirrors how a production state plugin
// would work, but tested here with manual adjacency maps.

function makeStInterp() {
  const cells: Record<string, { value: unknown }> = {};
  const interp: Interpreter = {
    "num/literal": async function* (e) {
      return e.out;
    },
    "st/let": async function* (entry) {
      const initial = yield 0;
      const cellId = entry.children[0]; // use child id as cell key
      cells[cellId] = { value: initial };
      return yield 1; // evaluate body
    },
    "st/get": async function* (entry) {
      const cellId = entry.out as string;
      return cells[cellId]?.value;
    },
    "st/set": async function* (entry) {
      const cellId = entry.out as string;
      const newVal = yield 0;
      cells[cellId] = { value: newVal };
      return newVal;
    },
    "st/seq": async function* (entry) {
      let last: unknown;
      for (let i = 0; i < entry.children.length; i++) {
        last = yield i;
      }
      return last;
    },
    "st/push": async function* (entry) {
      const cellId = entry.out as string;
      const item = yield 0;
      const arr = cells[cellId]?.value as unknown[];
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

// ═══════════════════════════════════════════════════════════════════
// Basic state via closures
// ═══════════════════════════════════════════════════════════════════

describe("state management golden tests", () => {
  describe("basic state via closures", () => {
    test("let(5) -> get returns 5", async () => {
      const { interp } = makeStInterp();
      // let(initial=5, body=get(cell))
      // cell "v" holds initial, body reads it back
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
        // seq: set then get
        body: { kind: "st/seq", children: ["s", "g"], out: undefined },
        root: { kind: "st/let", children: ["init", "body"], out: undefined },
      };
      expect(await fold<number>("root", adj, interp)).toBe(10);
    });

    test("multiple let bindings are independent cells", async () => {
      const { interp } = makeStInterp();
      // Two independent cells: x=3, y=7, read both and add
      const adj: Record<string, RuntimeEntry> = {
        three: { kind: "num/literal", children: [], out: 3 },
        seven: { kind: "num/literal", children: [], out: 7 },
        gx: { kind: "st/get", children: [], out: "three" },
        gy: { kind: "st/get", children: [], out: "seven" },
        // Inner let: y=7, body reads x+y via seq returning last
        innerBody: { kind: "st/seq", children: ["gx", "gy"], out: undefined },
        inner: {
          kind: "st/let",
          children: ["seven", "innerBody"],
          out: undefined,
        },
        // Outer let: x=3, body is inner let
        root: { kind: "st/let", children: ["three", "inner"], out: undefined },
      };
      // seq returns last child = gy = 7
      expect(await fold<number>("root", adj, interp)).toBe(7);
    });

    test("state persists through sequence (begin pattern)", async () => {
      const { interp } = makeStInterp();
      // let(x=1), set(x=2), set(x=3), get(x) -> 3
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

  // ═══════════════════════════════════════════════════════════════════
  // Push to array
  // ═══════════════════════════════════════════════════════════════════

  describe("push to array", () => {
    test("push adds item to array cell", async () => {
      const { interp, cells } = makeStInterp();
      // Manually init cell, then push via fold
      cells["arr"] = { value: [1, 2] };
      const adj: Record<string, RuntimeEntry> = {
        item: { kind: "num/literal", children: [], out: 3 },
        p: { kind: "st/push", children: ["item"], out: "arr" },
      };
      const result = await fold<number[]>("p", adj, interp);
      expect(result).toEqual([1, 2, 3]);
    });

    test("multiple pushes accumulate", async () => {
      const { interp, cells } = makeStInterp();
      cells["arr"] = { value: [] as number[] };
      const adj: Record<string, RuntimeEntry> = {
        a: { kind: "num/literal", children: [], out: 10 },
        b: { kind: "num/literal", children: [], out: 20 },
        c: { kind: "num/literal", children: [], out: 30 },
        p1: { kind: "st/push", children: ["a"], out: "arr" },
        p2: { kind: "st/push", children: ["b"], out: "arr" },
        p3: { kind: "st/push", children: ["c"], out: "arr" },
        seq: {
          kind: "st/seq",
          children: ["p1", "p2", "p3"],
          out: undefined,
        },
      };
      await fold<unknown>("seq", adj, interp);
      expect(cells["arr"].value).toEqual([10, 20, 30]);
    });

    test("push returns updated array", async () => {
      const { interp, cells } = makeStInterp();
      cells["arr"] = { value: ["x"] };
      const adj: Record<string, RuntimeEntry> = {
        item: { kind: "num/literal", children: [], out: 99 },
        p: { kind: "st/push", children: ["item"], out: "arr" },
      };
      const result = await fold<unknown[]>("p", adj, interp);
      expect(result).toEqual(["x", 99]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // State with control flow
  // ═══════════════════════════════════════════════════════════════════

  describe("state with control flow", () => {
    test("set inside cond true branch", async () => {
      const { interp } = makeStInterp();
      // let(x=0), cond(true, set(x=42), set(x=99)), get(x) -> 42
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
      // let(x=1), cond(true, set(x=100), noop), get(x) -> 100
      const adj: Record<string, RuntimeEntry> = {
        one: { kind: "num/literal", children: [], out: 1 },
        hun: { kind: "num/literal", children: [], out: 100 },
        noop: { kind: "num/literal", children: [], out: -1 },
        flag: { kind: "bool/literal", children: [], out: true },
        s: { kind: "st/set", children: ["hun"], out: "one" },
        cnd: {
          kind: "core/cond",
          children: ["flag", "s", "noop"],
          out: undefined,
        },
        g: { kind: "st/get", children: [], out: "one" },
        body: { kind: "st/seq", children: ["cnd", "g"], out: undefined },
        root: { kind: "st/let", children: ["one", "body"], out: undefined },
      };
      expect(await fold<number>("root", adj, interp)).toBe(100);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Volatile behavior documentation
  // ═══════════════════════════════════════════════════════════════════
  //
  // In production, st/get nodes are VOLATILE: the fold skips memoization
  // for them so that re-evaluation picks up mutations from st/set.
  // The current koan fold (16-bridge) memoizes ALL nodes, meaning a
  // second yield of the same st/get node ID returns the stale cached
  // value. These tests document the expected behavior for when the
  // production fold with VOLATILE_KINDS is implemented.

  describe("volatile behavior documentation", () => {
    test("sequential reads of same get node are memoized (koan fold limitation)", async () => {
      // This test demonstrates the memoization limitation:
      // Two seq steps yield the same st/get node, but fold memoizes it.
      // With VOLATILE_KINDS, the second read would re-evaluate.
      const { interp } = makeStInterp();
      const adj: Record<string, RuntimeEntry> = {
        init: { kind: "num/literal", children: [], out: 0 },
        five: { kind: "num/literal", children: [], out: 5 },
        g: { kind: "st/get", children: [], out: "init" },
        s: { kind: "st/set", children: ["five"], out: "init" },
        // seq: get(x=0), set(x=5), get(x) -- but g is memoized to 0
        body: { kind: "st/seq", children: ["g", "s", "g"], out: undefined },
        root: { kind: "st/let", children: ["init", "body"], out: undefined },
      };
      const result = await fold<number>("root", adj, interp);
      // Koan fold memoizes st/get "g" on first eval => returns 0
      // Production volatile fold would return 5 (re-evaluated after set)
      expect(result).toBe(0); // memoized: stale value
    });

    test("distinct get nodes avoid memoization issue", async () => {
      // Workaround: use distinct node IDs for each st/get to avoid
      // sharing the memoized result. This works in both koan and
      // production folds.
      const { interp } = makeStInterp();
      const adj: Record<string, RuntimeEntry> = {
        init: { kind: "num/literal", children: [], out: 0 },
        five: { kind: "num/literal", children: [], out: 5 },
        g1: { kind: "st/get", children: [], out: "init" },
        g2: { kind: "st/get", children: [], out: "init" },
        s: { kind: "st/set", children: ["five"], out: "init" },
        // seq: get1(x=0), set(x=5), get2(x=5)
        body: {
          kind: "st/seq",
          children: ["g1", "s", "g2"],
          out: undefined,
        },
        root: { kind: "st/let", children: ["init", "body"], out: undefined },
      };
      const result = await fold<number>("root", adj, interp);
      // Each get node is unique => no memoization conflict
      expect(result).toBe(5);
    });

    test("end-to-end state pattern with sequential evaluation", async () => {
      // Full state lifecycle: init -> mutate -> mutate -> read
      // Using distinct get/set nodes to work with any fold impl
      const { interp } = makeStInterp();
      const adj: Record<string, RuntimeEntry> = {
        init: { kind: "num/literal", children: [], out: 0 },
        v1: { kind: "num/literal", children: [], out: 10 },
        v2: { kind: "num/literal", children: [], out: 20 },
        s1: { kind: "st/set", children: ["v1"], out: "init" },
        s2: { kind: "st/set", children: ["v2"], out: "init" },
        g: { kind: "st/get", children: [], out: "init" },
        body: {
          kind: "st/seq",
          children: ["s1", "s2", "g"],
          out: undefined,
        },
        root: { kind: "st/let", children: ["init", "body"], out: undefined },
      };
      expect(await fold<number>("root", adj, interp)).toBe(20);
    });

    test("volatile documentation: production fold would re-evaluate st/get", async () => {
      // This test documents the EXPECTED production behavior.
      // When VOLATILE_KINDS includes "st/get", the fold will:
      //   1. NOT memoize st/get nodes
      //   2. Re-run the handler on each yield of a st/get node ID
      //   3. Pick up state mutations from intervening st/set calls
      //
      // For now, we verify the workaround (distinct nodes) produces
      // correct results, and leave a marker for the production test.
      const { interp } = makeStInterp();
      const adj: Record<string, RuntimeEntry> = {
        init: { kind: "num/literal", children: [], out: 1 },
        v2: { kind: "num/literal", children: [], out: 2 },
        v3: { kind: "num/literal", children: [], out: 3 },
        s1: { kind: "st/set", children: ["v2"], out: "init" },
        g1: { kind: "st/get", children: [], out: "init" },
        s2: { kind: "st/set", children: ["v3"], out: "init" },
        g2: { kind: "st/get", children: [], out: "init" },
        body: {
          kind: "st/seq",
          children: ["s1", "g1", "s2", "g2"],
          out: undefined,
        },
        root: { kind: "st/let", children: ["init", "body"], out: undefined },
      };
      const result = await fold<number>("root", adj, interp);
      // g1 reads after s1(2), g2 reads after s2(3)
      // With distinct nodes, both koan and production folds return 3
      expect(result).toBe(3);
    });
  });
});
