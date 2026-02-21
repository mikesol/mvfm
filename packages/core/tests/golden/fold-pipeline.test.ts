import { describe, expect, test } from "vitest";
import {
  app,
  boolPlugin,
  byKind,
  commit,
  defaults,
  fold,
  type Interpreter,
  mvfm,
  numPlugin,
  type PluginDef,
  pipe,
  type RuntimeEntry,
  replaceWhere,
  stdPlugins,
  strPlugin,
} from "../../src/index";

// ── eq interpreter ───────────────────────────────────────────────────
const eqInterp: Interpreter = {
  "num/eq": async function* () {
    return ((yield 0) as number) === ((yield 1) as number);
  },
  "str/eq": async function* () {
    return ((yield 0) as string) === ((yield 1) as string);
  },
  "bool/eq": async function* () {
    return ((yield 0) as boolean) === ((yield 1) as boolean);
  },
};
const fpEq: PluginDef = {
  name: "eq",
  nodeKinds: ["num/eq", "str/eq", "bool/eq"],
  defaultInterpreter: () => eqInterp,
};
const fullInterp = defaults([...stdPlugins, fpEq]);
const $ = mvfm(numPlugin, strPlugin, boolPlugin);

// ── num interpreter for structural tests ─────────────────────────────
const numInterp = defaults(stdPlugins);

// ── Full pipeline ────────────────────────────────────────────────────
describe("full pipeline", () => {
  test("mvfm -> $ -> app -> fold", async () => {
    expect(await fold(app($.mul($.add(3, 4), 5)), fullInterp)).toBe(35);
  });
  test("mvfm -> app -> pipe(replaceWhere) -> fold", async () => {
    const p = app($.mul($.add(3, 4), 5));
    const rw = pipe(p, (e) => replaceWhere(e, byKind("num/add"), "num/sub"));
    expect(await fold(commit(rw), fullInterp)).toBe(-5);
  });
  test("eq(3,3) -> num/eq -> fold -> true", async () => {
    expect(await fold(app($.eq(3, 3)), fullInterp)).toBe(true);
  });
  test("eq('a','b') -> str/eq -> fold -> false", async () => {
    expect(await fold(app($.eq("a", "b")), fullInterp)).toBe(false);
  });
  test("nested eq(eq(3,3),eq(5,5)) -> true", async () => {
    expect(await fold(app($.eq($.eq(3, 3), $.eq(5, 5))), fullInterp)).toBe(true);
  });
});

// ── Structural fold ─────────────────────────────────────────────────
describe("structural fold", () => {
  const structInterp: Interpreter = {
    ...numInterp,
    "geom/point": async function* (entry) {
      const m = entry.out as Record<string, string>;
      const x = (yield m.x) as number;
      const y = (yield m.y) as number;
      return { x, y };
    },
  };
  test("handler yields string ID for named children", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 10 },
      b: { kind: "geom/point", children: [], out: { x: "a", y: "a" } },
    };
    expect(await fold<{ x: number; y: number }>("b", adj, structInterp)).toEqual({ x: 10, y: 10 });
  });
  test("geom/point with {x: add, y: literal}", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 1 },
      b: { kind: "num/literal", children: [], out: 2 },
      c: { kind: "num/literal", children: [], out: 3 },
      d: { kind: "num/add", children: ["a", "b"], out: undefined },
      e: { kind: "geom/point", children: [], out: { x: "d", y: "c" } },
    };
    const r = await fold<{ x: number; y: number }>("e", adj, structInterp);
    expect(r.x).toBe(3);
    expect(r.y).toBe(3);
  });
  test("result has correct x and y values", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 7 },
      b: { kind: "num/literal", children: [], out: 11 },
      c: { kind: "geom/point", children: [], out: { x: "a", y: "b" } },
    };
    expect(await fold<{ x: number; y: number }>("c", adj, structInterp)).toEqual({ x: 7, y: 11 });
  });
});
