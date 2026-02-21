/**
 * Koan gates (16-bridge): fold, defaults, interpreters, full pipeline.
 * Imports only from ../src/index — never from __koans__.
 */
import { describe, test, expect } from "vitest";
import type { RuntimeEntry, Interpreter, PluginDef } from "../src/index";
import {
  app, add, mul, numLit, eq, fold, defaults, pipe,
  replaceWhere, byKind, stdPlugins, numPluginU,
  mvfm, numPlugin, strPlugin, boolPlugin,
} from "../src/index";

// Local plugin defs for fold tests
const numPD: PluginDef = {
  name: "num",
  nodeKinds: ["num/literal", "num/add", "num/mul", "num/sub"],
  defaultInterpreter: () => ({
    "num/literal": async function* (e) { return e.out as number; },
    "num/add": async function* () { return ((yield 0) as number) + ((yield 1) as number); },
    "num/mul": async function* () { return ((yield 0) as number) * ((yield 1) as number); },
    "num/sub": async function* () { return ((yield 0) as number) - ((yield 1) as number); },
  }),
};
const boolPD: PluginDef = {
  name: "bool", nodeKinds: ["bool/literal"],
  defaultInterpreter: () => ({
    "bool/literal": async function* (e) { return e.out as boolean; },
  }),
};
const corePD: PluginDef = {
  name: "core", nodeKinds: ["core/cond"],
  defaultInterpreter: () => ({
    "core/cond": async function* () {
      const pred = (yield 0) as boolean;
      return pred ? yield 1 : yield 2;
    },
  }),
};
const strPD: PluginDef = {
  name: "str", nodeKinds: ["str/literal", "str/concat"],
  defaultInterpreter: () => ({
    "str/literal": async function* (e) { return e.out as string; },
    "str/concat": async function* (e) {
      const p: string[] = [];
      for (let i = 0; i < e.children.length; i++) p.push((yield i) as string);
      return p.join("");
    },
  }),
};
const customPD: PluginDef = { name: "custom", nodeKinds: ["custom/double"] };
const emptyPD: PluginDef = { name: "meta", nodeKinds: [] };

describe("16-bridge", () => {
  const prog = app(mul(add(numLit(3), numLit(4)), numLit(5)));
  const numInterp = defaults([numPD]);

  test("(3+4)*5 = 35", async () => {
    expect(await fold<number>(prog.__id, prog.__adj, numInterp)).toBe(35);
  });

  test("multi-plugin merge with cond", async () => {
    const interp = defaults([corePD, boolPD, numPD]);
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "bool/literal", children: [], out: true },
      b: { kind: "num/literal", children: [], out: 10 },
      c: { kind: "num/literal", children: [], out: 20 },
      d: { kind: "core/cond", children: ["a", "b", "c"], out: undefined },
    };
    expect(await fold<number>("d", adj, interp)).toBe(10);
    adj.a = { kind: "bool/literal", children: [], out: false };
    expect(await fold<number>("d", adj, interp)).toBe(20);
  });

  test("short-circuit: only taken branch evaluated", async () => {
    let evals = 0;
    const ti: Interpreter = {
      "bool/literal": async function* (e) { return e.out; },
      "num/literal": async function* (e) { evals++; return e.out; },
      "core/cond": async function* () { const p = yield 0; return p ? yield 1 : yield 2; },
    };
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "bool/literal", children: [], out: true },
      b: { kind: "num/literal", children: [], out: 10 },
      c: { kind: "num/literal", children: [], out: 20 },
      d: { kind: "core/cond", children: ["a", "b", "c"], out: undefined },
    };
    expect(await fold<number>("d", adj, ti)).toBe(10);
    expect(evals).toBe(1);
  });

  test("string concat", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "str/literal", children: [], out: "hello" },
      b: { kind: "str/literal", children: [], out: " " },
      c: { kind: "str/literal", children: [], out: "world" },
      d: { kind: "str/concat", children: ["a", "b", "c"], out: undefined },
    };
    expect(await fold<string>("d", adj, defaults([strPD]))).toBe("hello world");
  });

  test("override for plugin without defaultInterpreter", async () => {
    const ci = defaults([numPD, customPD], {
      custom: { "custom/double": async function* () { return ((yield 0) as number) * 2; } },
    });
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 7 },
      b: { kind: "custom/double", children: ["a"], out: undefined },
    };
    expect(await fold<number>("b", adj, ci)).toBe(14);
  });

  test("empty plugin harmless", async () => {
    expect(await fold<number>(prog.__id, prog.__adj, defaults([numPD, emptyPD]))).toBe(35);
  });

  test("defaults throws without interpreter or override", () => {
    expect(() => defaults([customPD])).toThrow(/no defaultInterpreter/);
  });

  test("memoization: shared node evaluated once", async () => {
    let litEvals = 0;
    const ci: Interpreter = {
      "num/literal": async function* (e) { litEvals++; return e.out as number; },
      "num/add": async function* () { return ((yield 0) as number) + ((yield 1) as number); },
    };
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 3 },
      b: { kind: "num/add", children: ["a", "a"], out: undefined },
    };
    expect(await fold<number>("b", adj, ci)).toBe(6);
    expect(litEvals).toBe(1);
  });

  test("handler runs exactly once per node", async () => {
    let addRuns = 0;
    const oi: Interpreter = {
      "num/literal": async function* (e) { return e.out as number; },
      "num/add": async function* () { addRuns++; return ((yield 0) as number) + ((yield 1) as number); },
      "num/mul": async function* () { return ((yield 0) as number) * ((yield 1) as number); },
    };
    expect(await fold<number>(prog.__id, prog.__adj, oi)).toBe(35);
    expect(addRuns).toBe(1);
  });

  test("transform then fold", async () => {
    const t = pipe(prog, (e) => replaceWhere(e, byKind("num/add"), "num/mul"));
    expect(await fold<number>(t.__id, t.__adj, numInterp)).toBe(60);
  });

  test("fold NExpr overload infers type", async () => {
    expect(await fold(prog, numInterp)).toBe(35);
  });

  test("fold throws on missing handler", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "bool/literal", children: [], out: true },
      d: { kind: "core/cond", children: ["a"], out: undefined },
    };
    await expect(fold("d", adj, defaults([numPD]))).rejects.toThrow(/no handler/);
  });

  test("fold throws on missing node", async () => {
    await expect(fold("nonexistent", {}, numInterp)).rejects.toThrow(/missing node/);
  });

  test("unified plugins via defaults(stdPlugins)", async () => {
    const p = app(add(numLit(10), numLit(20)));
    expect(await fold<number>(p.__id, p.__adj, defaults(stdPlugins))).toBe(30);
  });

  test("individual unified plugin in defaults", async () => {
    expect(await fold<number>(prog.__id, prog.__adj, defaults([numPluginU]))).toBe(35);
  });

  test("unified plugin with override", async () => {
    const oi = defaults(stdPlugins, {
      num: {
        "num/literal": async function* (e) { return (e.out as number) * 10; },
        "num/add": async function* () { return ((yield 0) as number) + ((yield 1) as number); },
        "num/mul": async function* () { return ((yield 0) as number) * ((yield 1) as number); },
        "num/sub": async function* () { return ((yield 0) as number) - ((yield 1) as number); },
      },
    });
    const p = app(add(numLit(10), numLit(20)));
    expect(await fold<number>(p.__id, p.__adj, oi)).toBe(300);
  });

  test("full pipeline: mvfm -> $ -> app -> dagql -> fold", async () => {
    const eqI: Interpreter = {
      "num/eq": async function* () { return ((yield 0) as number) === ((yield 1) as number); },
      "str/eq": async function* () { return ((yield 0) as string) === ((yield 1) as string); },
      "bool/eq": async function* () { return ((yield 0) as boolean) === ((yield 1) as boolean); },
    };
    const fpEq: PluginDef = { name: "eq", nodeKinds: ["num/eq", "str/eq", "bool/eq"], defaultInterpreter: () => eqI };
    const fi = defaults([numPD, strPD, boolPD, fpEq]);
    const $ = mvfm(numPlugin, strPlugin, boolPlugin);

    expect(await fold<boolean>(app($.eq(3, 4)).__id, app($.eq(3, 4)).__adj, fi)).toBe(false);
    expect(await fold<boolean>(app($.eq(3, 3)).__id, app($.eq(3, 3)).__adj, fi)).toBe(true);

    const eqToAdd = pipe(app($.eq(3, 3)), (e) => replaceWhere(e, byKind("num/eq"), "num/add"));
    expect(await fold<number>(eqToAdd.__id, eqToAdd.__adj, fi)).toBe(6);

    expect(await fold<boolean>(app($.eq("hello", "hello")).__id, app($.eq("hello", "hello")).__adj, fi)).toBe(true);
    expect(await fold<boolean>(app($.eq(true, true)).__id, app($.eq(true, true)).__adj, fi)).toBe(true);

    const nested = app($.eq($.eq(3, 3), $.eq(5, 5)));
    expect(await fold<boolean>(nested.__id, nested.__adj, fi)).toBe(true);

    const full = app($.mul($.add(3, 4), 5));
    expect(await fold<number>(full.__id, full.__adj, fi)).toBe(35);
    const rw = pipe(full, (e) => replaceWhere(e, byKind("num/add"), "num/sub"));
    expect(await fold<number>(rw.__id, rw.__adj, fi)).toBe(-5);
  });

  test("stack safety: 10k-deep chain folds", async () => {
    const DEPTH = 10_000;
    const adj: Record<string, RuntimeEntry> = {};
    adj.n0 = { kind: "num/literal", children: [], out: 1 };
    for (let i = 1; i < DEPTH; i++) {
      adj[`n${i}`] = { kind: "num/add", children: [`n${i - 1}`, `n${i - 1}`], out: undefined };
    }
    const r = await fold<number>(`n${DEPTH - 1}`, adj, numInterp);
    expect(typeof r).toBe("number");
    expect(r).toBeGreaterThan(0);
  });
});
