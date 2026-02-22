import { describe, expect, test } from "vitest";
import {
  add,
  app,
  defaults,
  fold,
  type Interpreter,
  mul,
  numLit,
  type RuntimeEntry,
  stdPlugins,
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
    const adj: Record<string, RuntimeEntry> = {};
    adj.shared = { kind: "num/literal", children: [], out: 5 };
    for (let i = 0; i < 10; i++) {
      adj[`a${i}`] = { kind: "num/add", children: ["shared", "shared"], out: undefined };
    }
    adj.p0 = { kind: "num/add", children: ["a8", "a9"], out: undefined };
    for (let i = 1; i < 9; i++) {
      adj[`p${i}`] = { kind: "num/add", children: [`a${8 - i}`, `p${i - 1}`], out: undefined };
    }
    const result = await fold<number>("p8", adj, interp);
    expect(result).toBe(100);
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
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 2 },
      b: { kind: "num/add", children: ["a", "a"], out: undefined },
      c: { kind: "num/add", children: ["b", "b"], out: undefined },
      d: { kind: "num/add", children: ["c", "c"], out: undefined },
    };
    expect(await fold<number>("d", adj, interp)).toBe(16);
  });
});
