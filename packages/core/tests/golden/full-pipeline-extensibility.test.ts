import { describe, expect, test } from "vitest";
import {
  add,
  app,
  boolPlugin,
  byKind,
  commit,
  createApp,
  defaults,
  fold,
  type Interpreter,
  lt,
  mul,
  mvfmU,
  numLit,
  numPlugin,
  ordPlugin,
  pipe,
  type RuntimeEntry,
  replaceWhere,
  stdPlugins,
  strPlugin,
} from "../../src/index";

// -- Shared interpreters --
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

const fpEq = {
  name: "eq",
  nodeKinds: ["num/eq", "str/eq", "bool/eq"],
  defaultInterpreter: () => eqInterp,
};
const fullInterp = defaults([...stdPlugins, fpEq]);
const numInterp = defaults(stdPlugins);
const $ = mvfmU(numPlugin, strPlugin, boolPlugin);

// =====================================================================
// createApp extensibility
// =====================================================================
describe("createApp extensibility", () => {
  test("createApp with ordPlugin: lt(3,5) -> true", async () => {
    const appOrd = createApp(...stdPlugins, ordPlugin);
    const prog = appOrd(lt(3, 5));
    const interp = defaults([...stdPlugins, ordPlugin]);
    expect(await fold(prog, interp)).toBe(true);
  });

  test("createApp with custom plugin tuple, fold works", async () => {
    const appCustom = createApp(numPlugin, strPlugin);
    const prog = appCustom(add(3, 4));
    const interp = defaults([numPlugin, strPlugin]);
    expect(await fold(prog, interp)).toBe(7);
  });

  test("unified plugins via mvfmU -> app -> fold", async () => {
    const $u = mvfmU(numPlugin, strPlugin, boolPlugin);
    const prog = app($u.mul($u.add(2, 3), 4));
    const interp = defaults(stdPlugins);
    expect(await fold(prog, interp)).toBe(20);
  });
});

// =====================================================================
// Multiple folds
// =====================================================================
describe("multiple folds", () => {
  test("same program folded twice gives same result", async () => {
    const prog = app($.mul($.add(3, 4), 5));
    const r1 = await fold(prog, numInterp);
    const r2 = await fold(prog, numInterp);
    expect(r1).toBe(35);
    expect(r2).toBe(35);
  });

  test("same program folded with different interpreters", async () => {
    const prog = app(mul(add(numLit(3), numLit(4)), numLit(5)));
    expect(await fold(prog, numInterp)).toBe(35);
    const scaledInterp = defaults(stdPlugins, {
      num: {
        "num/literal": async function* (e) {
          return (e.out as number) * 10;
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
    expect(await fold(prog, scaledInterp)).toBe(3500);
  });

  test("transform program between folds", async () => {
    const prog = app(mul(add(numLit(3), numLit(4)), numLit(5)));
    expect(await fold(prog, numInterp)).toBe(35);
    const transformed = pipe(prog, (e) => replaceWhere(e, byKind("num/add"), "num/sub"));
    expect(await fold(commit(transformed), numInterp)).toBe(-5);
  });
});

// =====================================================================
// Realistic scenarios
// =====================================================================
describe("realistic scenarios", () => {
  test("conditional via manual adj: if eq(x,y) then add else sub", async () => {
    const coreInterp: Interpreter = {
      "core/cond": async function* () {
        const pred = (yield 0) as boolean;
        return pred ? yield 1 : yield 2;
      },
    };
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 5 },
      b: { kind: "num/literal", children: [], out: 5 },
      c: { kind: "num/eq", children: ["a", "b"], out: undefined },
      d: { kind: "num/add", children: ["a", "b"], out: undefined },
      e: { kind: "num/sub", children: ["a", "b"], out: undefined },
      f: { kind: "core/cond", children: ["c", "d", "e"], out: undefined },
    };
    const interp = { ...defaults(stdPlugins), ...eqInterp, ...coreInterp };
    expect(await fold<number>("f", adj, interp)).toBe(10);
    adj.b = { kind: "num/literal", children: [], out: 3 };
    expect(await fold<number>("f", adj, interp)).toBe(2);
  });

  test("calculator with rewrite: build, rewrite ops, fold", async () => {
    const prog = app($.mul($.add(2, 3), $.add(4, 5)));
    expect(await fold(prog, numInterp)).toBe(45);
    const rewritten = pipe(prog, (e) => replaceWhere(e, byKind("num/add"), "num/sub"));
    expect(await fold(commit(rewritten), numInterp)).toBe(1);
    const rewritten2 = pipe(rewritten, (e) => replaceWhere(e, byKind("num/mul"), "num/add"));
    expect(await fold(commit(rewritten2), numInterp)).toBe(-2);
  });

  test("pipeline composition: build, transform, transform, fold", async () => {
    const prog = app($.mul($.add(1, 2), $.add(3, 4)));
    const result = pipe(
      prog,
      (e) => replaceWhere(e, byKind("num/mul"), "num/add"),
      (e) => replaceWhere(e, byKind("num/add"), "num/sub"),
    );
    expect(await fold(commit(result), numInterp)).toBe(0);
  });

  test("mixed traits and arithmetic in one program", async () => {
    const prog = app($.eq($.add(1, 2), 3));
    expect(await fold(prog, fullInterp)).toBe(true);
    const prog2 = app($.eq($.mul(2, 3), $.add(3, 4)));
    expect(await fold(prog2, fullInterp)).toBe(false);
  });
});
