import { describe, expect, test } from "vitest";
import {
  add,
  app,
  fold,
  type Interpreter,
  mul,
  numLit,
  type RuntimeEntry,
  sub,
} from "../../src/index";

// -- shared interpreter --
const numInterp = {
  "num/literal": async function* (e: RuntimeEntry) {
    return e.out as number;
  },
  "num/add": async function* () {
    return ((yield 0) as number) + ((yield 1) as number);
  },
  "num/mul": async function* () {
    return ((yield 0) as number) * ((yield 1) as number);
  },
  "num/sub": async function* () {
    return ((yield 0) as number) - ((yield 1) as number);
  },
} satisfies Interpreter;

// -- Basic fold --
describe("basic fold", () => {
  test("(3+4)*5 = 35", async () => {
    expect(await fold(app(mul(add(numLit(3), numLit(4)), numLit(5))), numInterp)).toBe(35);
  });
  test("single literal", async () => {
    expect(await fold(app(numLit(42)), numInterp)).toBe(42);
  });
  test("sub(10,3) = 7", async () => {
    expect(await fold(app(sub(numLit(10), numLit(3))), numInterp)).toBe(7);
  });
  test("nested 4 levels: (10-3)*(1+2)+5 = 26", async () => {
    const p = app(add(mul(sub(numLit(10), numLit(3)), add(numLit(1), numLit(2))), numLit(5)));
    expect(await fold(p, numInterp)).toBe(26);
  });
  test("mul(2,3) = 6", async () => {
    expect(await fold(app(mul(numLit(2), numLit(3))), numInterp)).toBe(6);
  });
  test("sub(0,5) = -5", async () => {
    expect(await fold(app(sub(numLit(0), numLit(5))), numInterp)).toBe(-5);
  });
  test("add(0,0) = 0", async () => {
    expect(await fold(app(add(numLit(0), numLit(0))), numInterp)).toBe(0);
  });
  test("mul(add(1,1),sub(5,3)) = 4", async () => {
    expect(
      await fold(app(mul(add(numLit(1), numLit(1)), sub(numLit(5), numLit(3)))), numInterp),
    ).toBe(4);
  });
});

// -- Memoization --
describe("memoization", () => {
  const counting = (counter: { n: number }): Interpreter => ({
    "num/literal": async function* (e) {
      counter.n++;
      return e.out as number;
    },
    "num/add": async function* () {
      return ((yield 0) as number) + ((yield 1) as number);
    },
  });
  test("shared node evaluated once", async () => {
    const c = { n: 0 };
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 5 },
      b: { kind: "num/add", children: ["a", "a"], out: undefined },
    };
    expect(await fold<number>("b", adj, counting(c))).toBe(10);
    expect(c.n).toBe(1);
  });
  test("diamond: A -> B,C -> D, A evaluated once", async () => {
    const c = { n: 0 };
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 1 },
      b: { kind: "num/add", children: ["a", "a"], out: undefined },
      c: { kind: "num/add", children: ["a", "a"], out: undefined },
      d: { kind: "num/add", children: ["b", "c"], out: undefined },
    };
    expect(await fold<number>("d", adj, counting(c))).toBe(4);
    expect(c.n).toBe(1);
  });
  test("multiple shared leaves each once", async () => {
    const c = { n: 0 };
    const adj: Record<string, RuntimeEntry> = {
      x: { kind: "num/literal", children: [], out: 2 },
      y: { kind: "num/literal", children: [], out: 3 },
      p: { kind: "num/add", children: ["x", "y"], out: undefined },
      q: { kind: "num/add", children: ["x", "y"], out: undefined },
      r: { kind: "num/add", children: ["p", "q"], out: undefined },
    };
    expect(await fold<number>("r", adj, counting(c))).toBe(10);
    expect(c.n).toBe(2);
  });
  test("handler runs exactly once per node", async () => {
    let addRuns = 0;
    const oi: Interpreter = {
      "num/literal": async function* (e) {
        return e.out as number;
      },
      "num/add": async function* () {
        addRuns++;
        return ((yield 0) as number) + ((yield 1) as number);
      },
      "num/mul": async function* () {
        return ((yield 0) as number) * ((yield 1) as number);
      },
    };
    expect(await fold(app(mul(add(numLit(3), numLit(4)), numLit(5))), oi)).toBe(35);
    expect(addRuns).toBe(1);
  });
  test("shared add node evaluated once", async () => {
    let addRuns = 0;
    const ci: Interpreter = {
      "num/literal": async function* (e) {
        return e.out as number;
      },
      "num/add": async function* () {
        addRuns++;
        return ((yield 0) as number) + ((yield 1) as number);
      },
    };
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 1 },
      b: { kind: "num/literal", children: [], out: 2 },
      s: { kind: "num/add", children: ["a", "b"], out: undefined },
      t: { kind: "num/add", children: ["s", "s"], out: undefined },
    };
    expect(await fold<number>("t", adj, ci)).toBe(6);
    expect(addRuns).toBe(2);
  });
});

// -- Short-circuit --
describe("short-circuit", () => {
  const condAdj = (pred: boolean): Record<string, RuntimeEntry> => ({
    a: { kind: "bool/literal", children: [], out: pred },
    b: { kind: "num/literal", children: [], out: 10 },
    c: { kind: "num/literal", children: [], out: 20 },
    d: { kind: "core/cond", children: ["a", "b", "c"], out: undefined },
  });
  const trackingInterp = (counter: { n: number }): Interpreter => ({
    "bool/literal": async function* (e) {
      return e.out;
    },
    "num/literal": async function* (e) {
      counter.n++;
      return e.out;
    },
    "core/cond": async function* () {
      return (yield 0) ? yield 1 : yield 2;
    },
  });
  test("cond(true) evaluates only then-branch", async () => {
    const c = { n: 0 };
    expect(await fold<number>("d", condAdj(true), trackingInterp(c))).toBe(10);
    expect(c.n).toBe(1);
  });
  test("cond(false) evaluates only else-branch", async () => {
    const c = { n: 0 };
    expect(await fold<number>("d", condAdj(false), trackingInterp(c))).toBe(20);
    expect(c.n).toBe(1);
  });
  test("only 1 branch literal evaluated", async () => {
    const c = { n: 0 };
    await fold<number>("d", condAdj(false), trackingInterp(c));
    expect(c.n).toBe(1);
  });
});
