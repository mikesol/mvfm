import { describe, expect, test } from "vitest";
import {
  add,
  app,
  defaults,
  fold,
  type Interpreter,
  mul,
  numLit,
  type PluginDef,
  type RuntimeEntry,
  stdPlugins,
} from "../../src/index";

// -- shared interpreter --
const numInterp = defaults([
  {
    name: "num",
    nodeKinds: ["num/literal", "num/add", "num/mul", "num/sub"],
    defaultInterpreter: () => ({
      "num/literal": async function* (e) {
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
    }),
  },
]);

// -- Handler protocol --
describe("handler protocol", () => {
  test("yield number returns child at index", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 7 },
      b: { kind: "num/literal", children: [], out: 3 },
      c: { kind: "num/add", children: ["a", "b"], out: undefined },
    };
    expect(await fold<number>("c", adj, numInterp)).toBe(10);
  });
  test("yield string returns node by ID", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 99 },
      b: { kind: "geom/wrap", children: [], out: { ref: "a" } },
    };
    const si: Interpreter = {
      ...numInterp,
      "geom/wrap": async function* (e) {
        return yield (e.out as any).ref;
      },
    };
    expect(await fold<number>("b", adj, si)).toBe(99);
  });
  test("missing handler throws", async () => {
    const adj: Record<string, RuntimeEntry> = { a: { kind: "x/y", children: [], out: 1 } };
    await expect(fold<number>("a", adj, numInterp)).rejects.toThrow("no handler");
  });
  test("missing node throws", async () => {
    await expect(fold<number>("nope", {}, numInterp)).rejects.toThrow("missing node");
  });
  test("out-of-range child index throws", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 1 },
      b: { kind: "num/add", children: ["a"], out: undefined },
    };
    await expect(fold<number>("b", adj, numInterp)).rejects.toThrow();
  });
});

// -- NExpr overload --
describe("NExpr overload", () => {
  test("fold(expr, interp) infers number", async () => {
    const r = await fold(app(add(numLit(1), numLit(2))), numInterp);
    expect(r).toBe(3);
  });
  test("fold(expr, interp) without manual <T>", async () => {
    const r: number = await fold(app(mul(numLit(6), numLit(7))), numInterp);
    expect(r).toBe(42);
  });
  test("3-arg form still works", async () => {
    const p = app(numLit(99));
    expect(await fold<number>(p.__id, p.__adj, numInterp)).toBe(99);
  });
});

// -- defaults() --
describe("defaults()", () => {
  test("defaults(stdPlugins) works", async () => {
    expect(await fold(app(add(numLit(2), numLit(3))), defaults(stdPlugins))).toBe(5);
  });
  test("override replaces plugin", async () => {
    const interp = defaults(stdPlugins, {
      num: {
        "num/literal": async function* (e) {
          return (e.out as number) * 100;
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
      },
    });
    expect(await fold(app(add(numLit(1), numLit(2))), interp)).toBe(300);
  });
  test("throws without defaultInterpreter and no override", () => {
    expect(() => defaults([{ name: "x", nodeKinds: ["x/foo"] }])).toThrow("no defaultInterpreter");
  });
  test("empty plugin is harmless", () => {
    expect(defaults([{ name: "e", nodeKinds: [] }])).toEqual({});
  });
  test("override with custom handlers", async () => {
    const interp = defaults(
      [
        {
          name: "num",
          nodeKinds: ["num/literal"],
          defaultInterpreter: () => ({
            "num/literal": async function* (e) {
              return e.out as number;
            },
          }),
        },
        { name: "c", nodeKinds: ["c/dbl"] } as PluginDef,
      ],
      {
        c: {
          "c/dbl": async function* () {
            return ((yield 0) as number) * 2;
          },
        },
      },
    );
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 4 },
      b: { kind: "c/dbl", children: ["a"], out: undefined },
    };
    expect(await fold<number>("b", adj, interp)).toBe(8);
  });
});

// -- Stack safety --
describe("stack safety", () => {
  test("10k-deep chain doesn't overflow", async () => {
    const D = 10_000;
    const adj: Record<string, RuntimeEntry> = { n0: { kind: "num/literal", children: [], out: 1 } };
    for (let i = 1; i < D; i++)
      adj[`n${i}`] = { kind: "num/add", children: [`n${i - 1}`, `n${i - 1}`], out: undefined };
    const r = await fold<number>(`n${D - 1}`, adj, numInterp);
    expect(typeof r).toBe("number");
  });
  test("result is a valid number", async () => {
    const adj: Record<string, RuntimeEntry> = {
      n0: { kind: "num/literal", children: [], out: 1 },
      n1: { kind: "num/add", children: ["n0", "n0"], out: undefined },
      n2: { kind: "num/add", children: ["n1", "n1"], out: undefined },
    };
    expect(await fold<number>("n2", adj, numInterp)).toBe(4);
  });
});
