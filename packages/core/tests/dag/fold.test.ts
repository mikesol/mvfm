import { describe, it, expect } from "vitest";
import {
  makeNExpr,
  numLit,
  add,
  mul,
  app,
  fold,
} from "../../src/dag/index";
import type {
  RuntimeEntry,
  NExpr,
  Handler,
  Interpreter,
} from "../../src/dag/index";

// ─── Test helpers ───────────────────────────────────────────────────

function litHandler(): Handler {
  return async function* (entry: RuntimeEntry) {
    return entry.out;
  };
}

function addHandler(): Handler {
  return async function* (entry: RuntimeEntry) {
    const left = yield 0;
    const right = yield 1;
    return (left as number) + (right as number);
  };
}

function mulHandler(): Handler {
  return async function* (entry: RuntimeEntry) {
    const left = yield 0;
    const right = yield 1;
    return (left as number) * (right as number);
  };
}

const numInterp: Interpreter = {
  "num/literal": litHandler(),
  "num/add": addHandler(),
  "num/mul": mulHandler(),
};

// ─── Tests ──────────────────────────────────────────────────────────

describe("fold()", () => {
  it("evaluates a single literal node", async () => {
    const prog = app(numLit(42));
    const result = await fold(prog, numInterp);
    expect(result).toBe(42);
  });

  it("evaluates add(numLit(3), numLit(4)) = 7", async () => {
    const prog = app(add(numLit(3), numLit(4)));
    const result = await fold(prog, numInterp);
    expect(result).toBe(7);
  });

  it("evaluates nested mul(add(3,4), 5) = 35", async () => {
    const prog = app(mul(add(numLit(3), numLit(4)), numLit(5)));
    const result = await fold(prog, numInterp);
    expect(result).toBe(35);
  });

  it("memoizes shared DAG nodes (evaluates once)", async () => {
    let litCalls = 0;
    const countingInterp: Interpreter = {
      "num/literal": async function* (entry: RuntimeEntry) {
        litCalls++;
        return entry.out;
      },
      "num/add": addHandler(),
    };
    // add(x, x) where x = numLit(3) — content-addressed so L3 appears once
    const prog = app(add(numLit(3), numLit(3)));
    const result = await fold(prog, countingInterp);
    expect(result).toBe(6);
    expect(litCalls).toBe(1);
  });

  it("short-circuits: only evaluates the taken branch", async () => {
    let evalCount = 0;
    const trackingLit: Handler = async function* (entry: RuntimeEntry) {
      evalCount++;
      return entry.out;
    };
    // core/cond: children = [condition, thenBranch, elseBranch]
    const condHandler: Handler = async function* (_entry: RuntimeEntry) {
      const cond = yield 0;
      if (cond) {
        return yield 1;
      }
      return yield 2;
    };
    const interp: Interpreter = {
      "bool/literal": trackingLit,
      "num/literal": trackingLit,
      "core/cond": condHandler,
    };
    // Manual adj: cond(true, 10, 20) — should only eval true + 10
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "bool/literal", children: [], out: true },
      b: { kind: "num/literal", children: [], out: 10 },
      c: { kind: "num/literal", children: [], out: 20 },
      d: { kind: "core/cond", children: ["a", "b", "c"], out: undefined },
    };
    const expr = makeNExpr<number, "d", unknown, "e">("d", adj, "e");
    const result = await fold(expr, interp);
    expect(result).toBe(10);
    expect(evalCount).toBe(2); // bool/literal + taken num/literal
  });

  it("is stack-safe for 10k+ deep chains", async () => {
    const depth = 12_000;
    const adj: Record<string, RuntimeEntry> = {};
    // Build a chain: node_0 is literal, node_i wraps node_{i-1}
    adj["n0"] = { kind: "num/literal", children: [], out: 1 };
    for (let i = 1; i < depth; i++) {
      adj[`n${i}`] = {
        kind: "num/identity",
        children: [`n${i - 1}`],
        out: undefined,
      };
    }
    const rootId = `n${depth - 1}`;
    const interp: Interpreter = {
      ...numInterp,
      "num/identity": async function* (_entry: RuntimeEntry) {
        const val = yield 0;
        return val;
      },
    };
    const expr = makeNExpr<number, string, unknown, string>(
      rootId,
      adj,
      `n${depth}`,
    );
    const result = await fold(expr, interp);
    expect(result).toBe(1);
  });

  it("handles variadic children (str/concat)", async () => {
    const concatHandler: Handler = async function* (entry: RuntimeEntry) {
      let result = "";
      for (let i = 0; i < entry.children.length; i++) {
        const val = yield i;
        result += val as string;
      }
      return result;
    };
    const interp: Interpreter = {
      "str/literal": async function* (entry: RuntimeEntry) {
        return entry.out;
      },
      "str/concat": concatHandler,
    };
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "str/literal", children: [], out: "hello" },
      b: { kind: "str/literal", children: [], out: " " },
      c: { kind: "str/literal", children: [], out: "world" },
      d: { kind: "str/concat", children: ["a", "b", "c"], out: undefined },
    };
    const expr = makeNExpr<string, "d", unknown, "e">("d", adj, "e");
    const result = await fold(expr, interp);
    expect(result).toBe("hello world");
  });

  it("throws on missing handler", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "unknown/kind", children: [], out: 1 },
    };
    const expr = makeNExpr<number, "a", unknown, "b">("a", adj, "b");
    await expect(fold(expr, numInterp)).rejects.toThrow(
      'fold: no handler for "unknown/kind"',
    );
  });

  it("throws on missing node", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/add", children: ["b", "c"], out: undefined },
    };
    // b and c don't exist in adj
    const expr = makeNExpr<number, "a", unknown, "d">("a", adj, "d");
    await expect(fold(expr, numInterp)).rejects.toThrow(
      'fold: missing node "b"',
    );
  });

  it("throws on invalid child index", async () => {
    const badHandler: Handler = async function* (_entry: RuntimeEntry) {
      yield 99; // no child at index 99
      return 0;
    };
    const interp: Interpreter = { "test/bad": badHandler };
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "test/bad", children: [], out: undefined },
    };
    const expr = makeNExpr<number, "a", unknown, "b">("a", adj, "b");
    await expect(fold(expr, interp)).rejects.toThrow(
      'fold: node "a" (test/bad) has no child at index 99',
    );
  });

  it("runs each handler exactly once per node", async () => {
    const counts: Record<string, number> = {};
    const countingInterp: Interpreter = {
      "num/literal": async function* (entry: RuntimeEntry) {
        counts[entry.kind] = (counts[entry.kind] ?? 0) + 1;
        return entry.out;
      },
      "num/add": async function* (entry: RuntimeEntry) {
        counts[entry.kind] = (counts[entry.kind] ?? 0) + 1;
        const l = yield 0;
        const r = yield 1;
        return (l as number) + (r as number);
      },
      "num/mul": async function* (entry: RuntimeEntry) {
        counts[entry.kind] = (counts[entry.kind] ?? 0) + 1;
        const l = yield 0;
        const r = yield 1;
        return (l as number) * (r as number);
      },
    };
    const prog = app(mul(add(numLit(3), numLit(4)), numLit(5)));
    await fold(prog, countingInterp);
    // 3 literals, 1 add, 1 mul = 5 total handler calls
    expect(counts["num/literal"]).toBe(3);
    expect(counts["num/add"]).toBe(1);
    expect(counts["num/mul"]).toBe(1);
  });
});
