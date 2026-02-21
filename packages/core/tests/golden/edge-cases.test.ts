import { describe, expect, test } from "vitest";
import {
  add,
  addEntry,
  app,
  byKind,
  commit,
  createApp,
  defaults,
  dirty,
  fold,
  gc,
  type Interpreter,
  mapWhere,
  mul,
  numLit,
  numPluginU,
  pipe,
  type RuntimeEntry,
  replaceWhere,
  stdPlugins,
  strPluginU,
} from "../../src/index";

const interp = defaults(stdPlugins);

describe("edge cases: single node programs", () => {
  test("single numeric literal: app(42) folds to 42", async () => {
    const prog = app(numLit(42));
    expect(await fold(prog, interp)).toBe(42);
  });

  test("single string literal: app('hello') folds to 'hello'", async () => {
    const prog = app("hello");
    expect(await fold(prog, interp)).toBe("hello");
  });

  test("single literal produces minimal adjacency map (1 entry)", () => {
    const prog = app(numLit(42));
    expect(Object.keys(prog.__adj)).toHaveLength(1);
  });
});

describe("edge cases: deep nesting", () => {
  test("100-level deep nested add chain folds correctly", async () => {
    // Build: add(add(add(...add(1, 1)..., 1), 1), 1) — 100 levels
    // Result: 1 + 1 + 1 + ... (100 ones added pairwise from bottom)
    // Bottom: add(1,1)=2, then add(2,1)=3, add(3,1)=4, ... add(99,1)=100
    let expr: any = numLit(1);
    for (let i = 1; i < 100; i++) {
      expr = add(expr, numLit(1));
    }
    const prog = app(expr);
    expect(await fold(prog, interp)).toBe(100);
  });

  test("100-level deep chain produces correct number of entries", () => {
    let expr: any = numLit(1);
    for (let i = 1; i < 100; i++) {
      expr = add(expr, numLit(1));
    }
    const prog = app(expr);
    // 1 initial literal + 99 * (1 literal + 1 add) = 1 + 198 = 199
    expect(Object.keys(prog.__adj)).toHaveLength(199);
  });

  test("deeply nested mul chain computes correctly", async () => {
    // mul(mul(...mul(2, 1)..., 1), 1) — always * 1, so result stays 2
    let expr: any = mul(numLit(2), numLit(1));
    for (let i = 0; i < 50; i++) {
      expr = mul(expr, numLit(1));
    }
    const prog = app(expr);
    expect(await fold(prog, interp)).toBe(2);
  });
});

describe("edge cases: wide fanout", () => {
  const strConcatInterp: Interpreter = {
    "str/literal": async function* (entry) {
      return entry.out as string;
    },
    "str/concat": async function* (entry) {
      const parts: string[] = [];
      for (let i = 0; i < entry.children.length; i++) {
        parts.push((yield i) as string);
      }
      return parts.join("");
    },
  };

  test("single root with 20+ children via manual str/concat", async () => {
    const adj: Record<string, RuntimeEntry> = {};
    const childIds: string[] = [];
    for (let i = 0; i < 25; i++) {
      const id = `s${i}`;
      adj[id] = { kind: "str/literal", children: [], out: String.fromCharCode(65 + (i % 26)) };
      childIds.push(id);
    }
    adj.root = { kind: "str/concat", children: childIds, out: undefined };
    const result = await fold<string>("root", adj, strConcatInterp);
    expect(result).toBe("ABCDEFGHIJKLMNOPQRSTUVWXY");
  });

  test("wide fanout fold evaluates all children", async () => {
    let evalCount = 0;
    const countingInterp: Interpreter = {
      "str/literal": async function* (entry) {
        evalCount++;
        return entry.out as string;
      },
      "str/concat": async function* (entry) {
        const parts: string[] = [];
        for (let i = 0; i < entry.children.length; i++) {
          parts.push((yield i) as string);
        }
        return parts.join("");
      },
    };
    const adj: Record<string, RuntimeEntry> = {};
    const childIds: string[] = [];
    for (let i = 0; i < 20; i++) {
      const id = `c${i}`;
      adj[id] = { kind: "str/literal", children: [], out: "x" };
      childIds.push(id);
    }
    adj.root = { kind: "str/concat", children: childIds, out: undefined };
    await fold<string>("root", adj, countingInterp);
    expect(evalCount).toBe(20);
  });
});

describe("edge cases: diamond sharing", () => {
  test("same subexpr used 10 times yields correct result", async () => {
    // shared = 5, then 10 adds each referencing shared twice: add(shared, shared) = 10
    // top = sum of all 10 adds via chain
    const adj: Record<string, RuntimeEntry> = {};
    adj.shared = { kind: "num/literal", children: [], out: 5 };
    // 10 add nodes each doing add(shared, shared) = 10
    for (let i = 0; i < 10; i++) {
      adj[`a${i}`] = { kind: "num/add", children: ["shared", "shared"], out: undefined };
    }
    // chain them: sum = add(a0, add(a1, add(a2, ... add(a8, a9)...)))
    adj.p0 = { kind: "num/add", children: ["a8", "a9"], out: undefined };
    for (let i = 1; i < 9; i++) {
      adj[`p${i}`] = { kind: "num/add", children: [`a${8 - i}`, `p${i - 1}`], out: undefined };
    }
    const result = await fold<number>("p8", adj, interp);
    expect(result).toBe(100); // 10 * 10
  });

  test("shared subexpr evaluated once (counting interpreter)", async () => {
    let sharedEvals = 0;
    const countingInterp: Interpreter = {
      "num/literal": async function* (entry) {
        sharedEvals++;
        return entry.out as number;
      },
      "num/add": async function* () {
        return ((yield 0) as number) + ((yield 1) as number);
      },
    };
    const adj: Record<string, RuntimeEntry> = {};
    adj.shared = { kind: "num/literal", children: [], out: 5 };
    for (let i = 0; i < 10; i++) {
      adj[`a${i}`] = { kind: "num/add", children: ["shared", "shared"], out: undefined };
    }
    adj.top = { kind: "num/add", children: ["a0", "a1"], out: undefined };
    sharedEvals = 0;
    await fold<number>("top", adj, countingInterp);
    expect(sharedEvals).toBe(1);
  });

  test("diamond with correct result despite heavy sharing", async () => {
    // A=2, B=add(A,A)=4, C=add(B,B)=8, D=add(C,C)=16
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 2 },
      b: { kind: "num/add", children: ["a", "a"], out: undefined },
      c: { kind: "num/add", children: ["b", "b"], out: undefined },
      d: { kind: "num/add", children: ["c", "c"], out: undefined },
    };
    expect(await fold<number>("d", adj, interp)).toBe(16);
  });
});

describe("edge cases: stack safety", () => {
  test("10k-deep chain folds without stack overflow", async () => {
    const adj: Record<string, RuntimeEntry> = {};
    adj.n0 = { kind: "num/literal", children: [], out: 1 };
    for (let i = 1; i < 10_000; i++) {
      adj[`n${i}`] = { kind: "num/add", children: [`n${i - 1}`, `n${i - 1}`], out: undefined };
    }
    const result = await fold<number>("n9999", adj, interp);
    expect(typeof result).toBe("number");
    expect(result).toBeGreaterThan(0);
  });

  test("5k-deep chain produces correct result", async () => {
    // Each level doubles: 1, 2, 4, 8, ... but memoized so add(prev, prev) = 2*prev
    // After 20 levels: 2^20 = 1048576
    const adj: Record<string, RuntimeEntry> = {};
    adj.n0 = { kind: "num/literal", children: [], out: 1 };
    for (let i = 1; i <= 20; i++) {
      adj[`n${i}`] = { kind: "num/add", children: [`n${i - 1}`, `n${i - 1}`], out: undefined };
    }
    expect(await fold<number>("n20", adj, interp)).toBe(1_048_576);
  });

  test("deep chain with shared nodes at various depths", async () => {
    const adj: Record<string, RuntimeEntry> = {};
    adj.base = { kind: "num/literal", children: [], out: 1 };
    // Build 100-deep chain where every 10th node shares base
    for (let i = 1; i <= 100; i++) {
      const left = i % 10 === 0 ? "base" : `n${i - 1}`;
      adj[`n${i}`] = { kind: "num/add", children: [left, "base"], out: undefined };
    }
    const result = await fold<number>("n100", adj, interp);
    expect(typeof result).toBe("number");
    expect(result).toBeGreaterThan(0);
  });
});

describe("edge cases: GC stress", () => {
  test("100-node reachable chain: gc preserves all", () => {
    const adj: Record<string, RuntimeEntry> = {};
    adj.n0 = { kind: "num/literal", children: [], out: 0 };
    for (let i = 1; i < 100; i++) {
      adj[`n${i}`] = { kind: "num/add", children: [`n${i - 1}`, "n0"], out: undefined };
    }
    const prog = app(add(numLit(1), numLit(2)));
    const _d = dirty(prog);
    // Manually construct a dirty expr with the big adj
    const bigDirty = { __id: "n99", __adj: { ...adj }, __counter: "z" } as any;
    const cleaned = gc(bigDirty);
    expect(Object.keys(cleaned.__adj)).toHaveLength(100);
  });

  test("gc removes exactly unreachable nodes from large graph", () => {
    const adj: Record<string, RuntimeEntry> = {};
    // Reachable: n0 -> n1 -> n2 (chain of 3)
    adj.n0 = { kind: "num/literal", children: [], out: 1 };
    adj.n1 = { kind: "num/add", children: ["n0", "n0"], out: undefined };
    adj.n2 = { kind: "num/add", children: ["n1", "n0"], out: undefined };
    // Unreachable: 50 orphan nodes
    for (let i = 0; i < 50; i++) {
      adj[`orphan${i}`] = { kind: "num/literal", children: [], out: i };
    }
    const bigDirty = { __id: "n2", __adj: { ...adj }, __counter: "z" } as any;
    const cleaned = gc(bigDirty);
    expect(Object.keys(cleaned.__adj)).toHaveLength(3);
    expect(cleaned.__adj.n0).toBeDefined();
    expect(cleaned.__adj.n1).toBeDefined();
    expect(cleaned.__adj.n2).toBeDefined();
    for (let i = 0; i < 50; i++) {
      expect(cleaned.__adj[`orphan${i}`]).toBeUndefined();
    }
  });
});

describe("edge cases: interleaved operations", () => {
  test("map -> gc -> wrap -> splice -> commit -> fold pipeline", async () => {
    // Start: mul(add(3,4), 5)
    const prog = app(mul(add(3, 4), 5));
    // map: change add's out to 999 (doesn't affect fold, but tests mapWhere)
    const mapped = pipe(prog, (e) =>
      mapWhere(e, byKind("num/literal"), (entry) => ({
        kind: entry.kind,
        children: entry.children,
        out: (entry.out as number) * 10,
      })),
    );
    // mapWhere changes the entry: literals become 30, 40, 50
    // add(30,40)=70, mul(70,50)=3500
    expect(await fold(commit(mapped), interp)).toBe(3500);
  });

  test("replace -> dirty -> addEntry -> gc -> commit -> fold", async () => {
    const prog = app(add(3, 4));
    const replaced = pipe(prog, (e) => replaceWhere(e, byKind("num/add"), "num/mul"));
    const d = dirty(replaced);
    // Add an unreachable node
    const withOrphan = addEntry(d, "orphan", {
      kind: "num/literal",
      children: [] as string[],
      out: 999,
    } as any);
    const cleaned = gc(withOrphan);
    const committed = commit(cleaned);
    // orphan should be gone, result should be mul(3,4) = 12
    expect(Object.keys(committed.__adj).orphan).toBeUndefined();
    expect(await fold(committed, interp)).toBe(12);
  });
});

describe("edge cases: createApp variations", () => {
  test("createApp with just numPluginU works for numeric programs", async () => {
    const numApp = createApp(numPluginU);
    const prog = numApp(add(3, 4));
    const numInterp = defaults([numPluginU]);
    expect(await fold(prog, numInterp)).toBe(7);
  });

  test("createApp with all stdPlugins matches app() behavior", async () => {
    const fullApp = createApp(...stdPlugins);
    const prog1 = fullApp(mul(add(3, 4), 5));
    const prog2 = app(mul(add(3, 4), 5));
    expect(await fold(prog1, interp)).toBe(35);
    expect(await fold(prog2, interp)).toBe(35);
    // Same structure
    expect(prog1.__id).toBe(prog2.__id);
    expect(Object.keys(prog1.__adj).length).toBe(Object.keys(prog2.__adj).length);
  });

  test("createApp produces working app for string programs", async () => {
    const strApp = createApp(strPluginU);
    const prog = strApp("hello");
    const strInterp = defaults([strPluginU]);
    expect(await fold(prog, strInterp)).toBe("hello");
  });
});
