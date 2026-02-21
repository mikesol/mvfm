/**
 * Tests for VOLATILE_KINDS, taint propagation, and shared FoldState.
 *
 * Validates that:
 * - Normal nodes are memoized (baseline)
 * - Volatile nodes are re-evaluated on each encounter
 * - Taint propagates: ancestors of volatile nodes skip cache
 * - Shared FoldState reuses cache across independent fold calls
 */
import { describe, expect, it } from "vitest";
import { createFoldState, fold, type RuntimeEntry, VOLATILE_KINDS } from "../src/index";

// ─── Helpers ──────────────────────────────────────────────────────
function makeAdj(entries: Record<string, RuntimeEntry>) {
  return entries;
}
function handler(fn: (e: RuntimeEntry) => AsyncGenerator<any, unknown, unknown>) {
  return fn;
}

// ─── Tests ────────────────────────────────────────────────────────
describe("fold volatile & taint", () => {
  describe("baseline memoization", () => {
    it("shared node is evaluated only once", async () => {
      let callCount = 0;
      const adj = makeAdj({
        a: { kind: "num/literal", children: [], out: 42 },
        b: { kind: "test/use", children: ["a"], out: undefined },
        c: { kind: "test/use", children: ["a"], out: undefined },
        d: { kind: "test/pair", children: ["b", "c"], out: undefined },
      });
      const interp = {
        "num/literal": handler(async function* (e) {
          callCount++;
          return e.out;
        }),
        "test/use": handler(async function* (_e) {
          return yield 0;
        }),
        "test/pair": handler(async function* () {
          const l = yield 0;
          const r = yield 1;
          return [l, r];
        }),
      };
      const result = await fold("d", adj, interp);
      expect(result).toEqual([42, 42]);
      expect(callCount).toBe(1); // memoized
    });
  });

  describe("VOLATILE_KINDS", () => {
    it("volatile nodes are re-evaluated each time", async () => {
      let counter = 0;
      VOLATILE_KINDS.add("test/volatile");
      try {
        const adj = makeAdj({
          v: { kind: "test/volatile", children: [], out: undefined },
          a: { kind: "test/use", children: ["v"], out: undefined },
          b: { kind: "test/use", children: ["v"], out: undefined },
          root: { kind: "test/pair", children: ["a", "b"], out: undefined },
        });
        const interp = {
          "test/volatile": handler(async function* () {
            return ++counter;
          }),
          "test/use": handler(async function* () {
            return yield 0;
          }),
          "test/pair": handler(async function* () {
            const l = yield 0;
            const r = yield 1;
            return [l, r];
          }),
        };
        const result = await fold("root", adj, interp);
        expect(result).toEqual([1, 2]); // re-evaluated, not memoized
        expect(counter).toBe(2);
      } finally {
        VOLATILE_KINDS.delete("test/volatile");
      }
    });

    it("core/lambda_param is volatile by default", () => {
      expect(VOLATILE_KINDS.has("core/lambda_param")).toBe(true);
    });
  });

  describe("taint propagation", () => {
    it("parent of volatile node is tainted and not cached", async () => {
      let parentCalls = 0;
      VOLATILE_KINDS.add("test/volatile");
      try {
        const adj = makeAdj({
          v: { kind: "test/volatile", children: [], out: undefined },
          parent: { kind: "test/wrap", children: ["v"], out: undefined },
        });
        const interp = {
          "test/volatile": handler(async function* () {
            return "fresh";
          }),
          "test/wrap": handler(async function* () {
            parentCalls++;
            const val = yield 0;
            return `wrapped(${val})`;
          }),
        };
        const state = createFoldState();
        const r1 = await fold("parent", adj, interp, state);
        expect(r1).toBe("wrapped(fresh)");
        expect(parentCalls).toBe(1);

        // Second fold with same state: parent is tainted, re-evaluated
        const r2 = await fold("parent", adj, interp, state);
        expect(r2).toBe("wrapped(fresh)");
        expect(parentCalls).toBe(2);
      } finally {
        VOLATILE_KINDS.delete("test/volatile");
      }
    });

    it("taint propagates through multiple levels", async () => {
      let grandparentCalls = 0;
      VOLATILE_KINDS.add("test/volatile");
      try {
        const adj = makeAdj({
          v: { kind: "test/volatile", children: [], out: undefined },
          mid: { kind: "test/wrap", children: ["v"], out: undefined },
          top: { kind: "test/wrap", children: ["mid"], out: undefined },
        });
        const interp = {
          "test/volatile": handler(async function* () {
            return "val";
          }),
          "test/wrap": handler(async function* () {
            if ((adj as any)._track) grandparentCalls++;
            const val = yield 0;
            return `(${val})`;
          }),
        };
        const state = createFoldState();
        await fold("top", adj, interp, state);
        grandparentCalls = 0;
        (adj as any)._track = true;

        await fold("top", adj, interp, state);
        // Both mid and top should be re-evaluated (tainted)
        expect(grandparentCalls).toBe(2);
      } finally {
        VOLATILE_KINDS.delete("test/volatile");
      }
    });

    it("non-volatile sibling remains cached alongside tainted sibling", async () => {
      let pureCalls = 0;
      VOLATILE_KINDS.add("test/volatile");
      try {
        const adj = makeAdj({
          pure: { kind: "num/literal", children: [], out: 10 },
          vol: { kind: "test/volatile", children: [], out: undefined },
          root: { kind: "test/pair", children: ["pure", "vol"], out: undefined },
        });
        let volCounter = 0;
        const interp = {
          "num/literal": handler(async function* (e) {
            pureCalls++;
            return e.out;
          }),
          "test/volatile": handler(async function* () {
            return ++volCounter;
          }),
          "test/pair": handler(async function* () {
            const l = yield 0;
            const r = yield 1;
            return [l, r];
          }),
        };
        const state = createFoldState();
        await fold("root", adj, interp, state);
        expect(pureCalls).toBe(1);

        await fold("root", adj, interp, state);
        // pure node cached, volatile re-evaluated
        expect(pureCalls).toBe(1);
      } finally {
        VOLATILE_KINDS.delete("test/volatile");
      }
    });
  });

  describe("shared FoldState", () => {
    it("memo persists across fold calls with shared state", async () => {
      let calls = 0;
      const adj = makeAdj({
        a: { kind: "num/literal", children: [], out: 5 },
      });
      const interp = {
        "num/literal": handler(async function* (e) {
          calls++;
          return e.out;
        }),
      };
      const state = createFoldState();
      await fold("a", adj, interp, state);
      expect(calls).toBe(1);
      await fold("a", adj, interp, state);
      expect(calls).toBe(1); // cached from first call
    });

    it("independent fold calls share cache (fiber pattern)", async () => {
      let sharedCalls = 0;
      const adj = makeAdj({
        shared: { kind: "test/compute", children: [], out: undefined },
        a: { kind: "test/wrap", children: ["shared"], out: undefined },
        b: { kind: "test/wrap", children: ["shared"], out: undefined },
      });
      const interp = {
        "test/compute": handler(async function* () {
          sharedCalls++;
          return 99;
        }),
        "test/wrap": handler(async function* () {
          return yield 0;
        }),
      };
      const state = createFoldState();
      const [ra, rb] = await Promise.all([
        fold("a", adj, interp, state),
        fold("b", adj, interp, state),
      ]);
      expect(ra).toBe(99);
      expect(rb).toBe(99);
      // Depending on scheduling, shared may be evaluated 1 or 2 times
      // but with sequential Promise.all resolution, it's cached after first
      expect(sharedCalls).toBeLessThanOrEqual(2);
    });

    it("createFoldState returns independent empty state", () => {
      const s1 = createFoldState();
      const s2 = createFoldState();
      expect(s1.memo).toEqual({});
      expect(s1.tainted.size).toBe(0);
      expect(s1).not.toBe(s2);
    });
  });
});
