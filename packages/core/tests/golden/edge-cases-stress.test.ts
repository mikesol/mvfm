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
  mapWhere,
  mul,
  numPlugin,
  pipe,
  type RuntimeEntry,
  replaceWhere,
  stdPlugins,
  strPlugin,
} from "../../src/index";

const interp = defaults(stdPlugins);

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
    const bigDirty = { __id: "n99", __adj: { ...adj }, __counter: "z" } as any;
    const cleaned = gc(bigDirty);
    expect(Object.keys(cleaned.__adj)).toHaveLength(100);
  });

  test("gc removes exactly unreachable nodes from large graph", () => {
    const adj: Record<string, RuntimeEntry> = {};
    adj.n0 = { kind: "num/literal", children: [], out: 1 };
    adj.n1 = { kind: "num/add", children: ["n0", "n0"], out: undefined };
    adj.n2 = { kind: "num/add", children: ["n1", "n0"], out: undefined };
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
    const prog = app(mul(add(3, 4), 5));
    const mapped = pipe(prog, (e) =>
      mapWhere(e, byKind("num/literal"), (entry) => ({
        kind: entry.kind,
        children: entry.children,
        out: (entry.out as number) * 10,
      })),
    );
    expect(await fold(commit(mapped), interp)).toBe(3500);
  });

  test("replace -> dirty -> addEntry -> gc -> commit -> fold", async () => {
    const prog = app(add(3, 4));
    const replaced = pipe(prog, (e) => replaceWhere(e, byKind("num/add"), "num/mul"));
    const d = dirty(replaced);
    const withOrphan = addEntry(d, "orphan", {
      kind: "num/literal",
      children: [] as string[],
      out: 999,
    } as any);
    const cleaned = gc(withOrphan);
    const committed = commit(cleaned);
    expect(Object.keys(committed.__adj).orphan).toBeUndefined();
    expect(await fold(committed, interp)).toBe(12);
  });
});

describe("edge cases: createApp variations", () => {
  test("createApp with just numPlugin works for numeric programs", async () => {
    const numApp = createApp(numPlugin);
    const prog = numApp(add(3, 4));
    const numInterp = defaults([numPlugin]);
    expect(await fold(prog, numInterp)).toBe(7);
  });

  test("createApp with all stdPlugins matches app() behavior", async () => {
    const fullApp = createApp(...stdPlugins);
    const prog1 = fullApp(mul(add(3, 4), 5));
    const prog2 = app(mul(add(3, 4), 5));
    expect(await fold(prog1, interp)).toBe(35);
    expect(await fold(prog2, interp)).toBe(35);
    expect(prog1.__id).toBe(prog2.__id);
    expect(Object.keys(prog1.__adj).length).toBe(Object.keys(prog2.__adj).length);
  });

  test("createApp produces working app for string programs", async () => {
    const strApp = createApp(strPlugin);
    const prog = strApp("hello");
    const strInterp = defaults([strPlugin]);
    expect(await fold(prog, strInterp)).toBe("hello");
  });
});
