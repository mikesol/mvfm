import { describe, expect, test } from "vitest";
import {
  add,
  app,
  boolPlugin,
  boolPluginU,
  byKind,
  byName,
  commit,
  createApp,
  defaults,
  dirty,
  fold,
  gc,
  type Interpreter,
  isLeaf,
  lt,
  mul,
  mvfm,
  mvfmU,
  name,
  numLit,
  numPlugin,
  numPluginU,
  ordPlugin,
  type PluginDef,
  pipe,
  type RuntimeEntry,
  replaceWhere,
  selectWhere,
  spliceWhere,
  stdPlugins,
  strPlugin,
  strPluginU,
  sub,
} from "../../src/index";

// ── Shared interpreters ─────────────────────────────────────────────
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
const _ordInterp: Interpreter = {
  "num/lt": async function* () {
    return ((yield 0) as number) < ((yield 1) as number);
  },
  "str/lt": async function* () {
    return ((yield 0) as string) < ((yield 1) as string);
  },
};

const fpEq: PluginDef = {
  name: "eq",
  nodeKinds: ["num/eq", "str/eq", "bool/eq"],
  defaultInterpreter: () => eqInterp,
};
const fullInterp = defaults([...stdPlugins, fpEq]);
const numInterp = defaults(stdPlugins);
const $ = mvfm(numPlugin, strPlugin, boolPlugin);

// ═════════════════════════════════════════════════════════════════════
// Calculator programs
// ═════════════════════════════════════════════════════════════════════
describe("calculator programs", () => {
  test("(2+3)*4 = 20", async () => {
    const prog = app($.mul($.add(2, 3), 4));
    expect(await fold(prog, numInterp)).toBe(20);
  });

  test("(10-3)*(2+1) = 21", async () => {
    const prog = app(mul(sub(numLit(10), numLit(3)), add(numLit(2), numLit(1))));
    expect(await fold(prog, numInterp)).toBe(21);
  });

  test("deeply nested via sub/mul/add constructors", async () => {
    // ((1+2)*(3+4)) - ((5+6)*(7+8))
    const prog = app(
      sub(
        mul(add(numLit(1), numLit(2)), add(numLit(3), numLit(4))),
        mul(add(numLit(5), numLit(6)), add(numLit(7), numLit(8))),
      ),
    );
    expect(await fold(prog, numInterp)).toBe(3 * 7 - 11 * 15);
  });

  test("transform add->mul via dagql then fold", async () => {
    // Original: (2+3)*4 = 20, after add->mul: (2*3)*4 = 24
    const prog = app($.mul($.add(2, 3), 4));
    const transformed = pipe(prog, (e) => replaceWhere(e, byKind("num/add"), "num/mul"));
    expect(await fold(commit(transformed), numInterp)).toBe(24);
  });

  test("transform mul->add then fold", async () => {
    // Original: (2+3)*4 = 20, after mul->add: (2+3)+4 = 9
    const prog = app($.mul($.add(2, 3), 4));
    const transformed = pipe(prog, (e) => replaceWhere(e, byKind("num/mul"), "num/add"));
    expect(await fold(commit(transformed), numInterp)).toBe(9);
  });
});

// ═════════════════════════════════════════════════════════════════════
// Trait dispatch pipeline
// ═════════════════════════════════════════════════════════════════════
describe("trait dispatch pipeline", () => {
  test("eq(3,3) -> true", async () => {
    expect(await fold(app($.eq(3, 3)), fullInterp)).toBe(true);
  });

  test("eq('a','b') -> false", async () => {
    expect(await fold(app($.eq("a", "b")), fullInterp)).toBe(false);
  });

  test("nested eq: eq(eq(3,3), eq(5,5)) -> true", async () => {
    expect(await fold(app($.eq($.eq(3, 3), $.eq(5, 5))), fullInterp)).toBe(true);
  });

  test("build eq, transform to add via pipe, fold -> number", async () => {
    const prog = app($.eq(3, 3));
    const transformed = pipe(prog, (e) => replaceWhere(e, byKind("num/eq"), "num/add"));
    expect(await fold(commit(transformed), fullInterp)).toBe(6);
  });

  test("selectWhere on eq-produced nodes", async () => {
    const prog = app($.eq(3, 4));
    const selected = selectWhere(prog, byKind("num/eq"));
    expect(selected.size).toBe(1);
    // Also verify the literals are present
    const literals = selectWhere(prog, byKind("num/literal"));
    expect(literals.size).toBe(2);
  });
});

// ═════════════════════════════════════════════════════════════════════
// DAG transform pipeline
// ═════════════════════════════════════════════════════════════════════
describe("DAG transform pipeline", () => {
  test("app -> pipe(replace, splice) -> fold", async () => {
    // (3+4)*5: replace add->sub, splice leaves -> 2 nodes remain
    const prog = app(mul(add(numLit(3), numLit(4)), numLit(5)));
    const transformed = pipe(
      prog,
      (e) => replaceWhere(e, byKind("num/add"), "num/sub"),
      (e) => spliceWhere(commit(e), isLeaf()),
    );
    // After splice, leaves gone; only sub and mul remain
    expect(Object.keys(transformed.__adj).length).toBe(2);
  });

  test("app -> pipe(replace, replace) -> fold", async () => {
    // (3+4)*5 = 35; replace add->sub: (3-4)*5 = -5; replace mul->add: (3-4)+5 = 4
    const prog = app(mul(add(numLit(3), numLit(4)), numLit(5)));
    const transformed = pipe(
      prog,
      (e) => replaceWhere(e, byKind("num/add"), "num/sub"),
      (e) => replaceWhere(e, byKind("num/mul"), "num/add"),
    );
    expect(await fold(commit(transformed), numInterp)).toBe(4);
  });

  test("app -> dirty -> gc -> commit -> fold round-trip", async () => {
    const prog = app(mul(add(numLit(3), numLit(4)), numLit(5)));
    const d = dirty(prog);
    const cleaned = gc(d);
    const committed = commit(cleaned);
    expect(await fold(committed, numInterp)).toBe(35);
  });

  test("app -> name -> selectWhere byName -> replaceWhere byKind -> fold", async () => {
    const prog = app(mul(add(numLit(3), numLit(4)), numLit(5)));
    // Name the add node "myAdd" (node "c" is add in the standard layout)
    const named = name(prog, "myAdd", "c");
    // Verify we can find the alias
    const aliases = selectWhere(named, byName("myAdd"));
    expect(aliases.size).toBe(1);
    // Replace add->sub, fold
    const transformed = pipe(named, (e) => replaceWhere(e, byKind("num/add"), "num/sub"));
    expect(await fold(commit(transformed), numInterp)).toBe(-5);
  });

  test("multiple pipe steps then fold", async () => {
    // (1+2)*(3+4) = 21
    const prog = app($.mul($.add(1, 2), $.add(3, 4)));
    const transformed = pipe(
      prog,
      (e) => replaceWhere(e, byKind("num/add"), "num/sub"),
      (e) => replaceWhere(e, byKind("num/mul"), "num/add"),
    );
    // After: (1-2)+(3-4) = -1 + -1 = -2
    expect(await fold(commit(transformed), numInterp)).toBe(-2);
  });
});

// ═════════════════════════════════════════════════════════════════════
// createApp extensibility
// ═════════════════════════════════════════════════════════════════════
describe("createApp extensibility", () => {
  test("createApp with ordPlugin: lt(3,5) -> true", async () => {
    const appOrd = createApp(...stdPlugins, ordPlugin);
    const prog = appOrd(lt(3, 5));
    const interp = defaults([...stdPlugins, ordPlugin]);
    expect(await fold(prog, interp)).toBe(true);
  });

  test("createApp with custom plugin tuple, fold works", async () => {
    const appCustom = createApp(numPluginU, strPluginU);
    const prog = appCustom(add(3, 4));
    const interp = defaults([numPluginU, strPluginU]);
    expect(await fold(prog, interp)).toBe(7);
  });

  test("unified plugins via mvfmU -> app -> fold", async () => {
    const $u = mvfmU(numPluginU, strPluginU, boolPluginU);
    const prog = app($u.mul($u.add(2, 3), 4));
    const interp = defaults(stdPlugins);
    expect(await fold(prog, interp)).toBe(20);
  });
});

// ═════════════════════════════════════════════════════════════════════
// Multiple folds
// ═════════════════════════════════════════════════════════════════════
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
    // Standard: (3+4)*5 = 35
    expect(await fold(prog, numInterp)).toBe(35);
    // Scaled interpreter: literals * 10
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
    // (30+40)*50 = 3500
    expect(await fold(prog, scaledInterp)).toBe(3500);
  });

  test("transform program between folds", async () => {
    const prog = app(mul(add(numLit(3), numLit(4)), numLit(5)));
    expect(await fold(prog, numInterp)).toBe(35);
    const transformed = pipe(prog, (e) => replaceWhere(e, byKind("num/add"), "num/sub"));
    expect(await fold(commit(transformed), numInterp)).toBe(-5);
  });
});

// ═════════════════════════════════════════════════════════════════════
// Realistic scenarios
// ═════════════════════════════════════════════════════════════════════
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
    // eq(5,5)=true -> add(5,5)=10
    expect(await fold<number>("f", adj, interp)).toBe(10);
    // Change to eq(5,3)=false -> sub(5,3)=2
    adj.b = { kind: "num/literal", children: [], out: 3 };
    expect(await fold<number>("f", adj, interp)).toBe(2);
  });

  test("calculator with rewrite: build, rewrite ops, fold", async () => {
    // Build (2+3)*(4+5) = 45
    const prog = app($.mul($.add(2, 3), $.add(4, 5)));
    expect(await fold(prog, numInterp)).toBe(45);
    // Rewrite all adds to subs: (2-3)*(4-5) = (-1)*(-1) = 1
    const rewritten = pipe(prog, (e) => replaceWhere(e, byKind("num/add"), "num/sub"));
    expect(await fold(commit(rewritten), numInterp)).toBe(1);
    // Rewrite mul to add on the rewritten: (2-3)+(4-5) = -2
    const rewritten2 = pipe(rewritten, (e) => replaceWhere(e, byKind("num/mul"), "num/add"));
    expect(await fold(commit(rewritten2), numInterp)).toBe(-2);
  });

  test("pipeline composition: build, transform, transform, fold", async () => {
    const prog = app($.mul($.add(1, 2), $.add(3, 4)));
    // Step 1: replace first kind, step 2: replace second kind
    const result = pipe(
      prog,
      (e) => replaceWhere(e, byKind("num/mul"), "num/add"),
      (e) => replaceWhere(e, byKind("num/add"), "num/sub"),
    );
    // All ops are now sub: (1-2) sub (3-4) = (-1) - (-1) = 0
    expect(await fold(commit(result), numInterp)).toBe(0);
  });

  test("mixed traits and arithmetic in one program", async () => {
    // eq(add(1,2), 3) -> eq(3, 3) -> true
    const prog = app($.eq($.add(1, 2), 3));
    expect(await fold(prog, fullInterp)).toBe(true);
    // eq(mul(2,3), add(3,4)) -> eq(6, 7) -> false
    const prog2 = app($.eq($.mul(2, 3), $.add(3, 4)));
    expect(await fold(prog2, fullInterp)).toBe(false);
  });
});
