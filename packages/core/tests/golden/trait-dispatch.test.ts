import { describe, expect, test } from "vitest";
import {
  app,
  boolPlugin,
  byKind,
  commit,
  createApp,
  defaults,
  eq,
  fold,
  type Interpreter,
  lt,
  mvfm,
  numPlugin,
  ordPlugin,
  pipe,
  replaceWhere,
  selectWhere,
  stdPlugins,
  strPlugin,
} from "../../src/index";

// ── Eq interpreter (stdPlugins doesn't include eq handlers) ──────
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

// Unified plugins already have eq interpreters built in
const fullInterp: Interpreter = { ...defaults(stdPlugins), ...eqInterp };

// ── Ord interpreter ──────────────────────────────────────────────
const ordInterp: Interpreter = {
  "num/lt": async function* () {
    return ((yield 0) as number) < ((yield 1) as number);
  },
  "str/lt": async function* () {
    return ((yield 0) as string) < ((yield 1) as string);
  },
};

// ═════════════════════════════════════════════════════════════════
// Numeric eq
// ═════════════════════════════════════════════════════════════════
describe("numeric eq", () => {
  const eqTrue = app(eq(3, 3));
  const eqFalse = app(eq(3, 4));

  test("app(eq(3,3)) adj has num/eq node", () => {
    const kinds = Object.values(eqTrue.__adj).map((e) => e.kind);
    expect(kinds).toContain("num/eq");
  });

  test("app(eq(3,3)) folds to true", async () => {
    expect(await fold(eqTrue, fullInterp)).toBe(true);
  });

  test("app(eq(3,4)) folds to false", async () => {
    expect(await fold(eqFalse, fullInterp)).toBe(false);
  });

  test("num/eq node has exactly 2 children", () => {
    const eqEntry = Object.values(eqTrue.__adj).find((e) => e.kind === "num/eq")!;
    expect(eqEntry.children).toHaveLength(2);
  });

  test("eq(0, 0) folds to true (zero equality)", async () => {
    expect(await fold(app(eq(0, 0)), fullInterp)).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════
// String eq
// ═════════════════════════════════════════════════════════════════
describe("string eq", () => {
  test("app(eq('a','a')) adj has str/eq, folds to true", async () => {
    const prog = app(eq("a", "a"));
    const kinds = Object.values(prog.__adj).map((e) => e.kind);
    expect(kinds).toContain("str/eq");
    expect(await fold(prog, fullInterp)).toBe(true);
  });

  test("app(eq('a','b')) folds to false", async () => {
    expect(await fold(app(eq("a", "b")), fullInterp)).toBe(false);
  });

  test("app(eq('hello','hello')) folds to true", async () => {
    expect(await fold(app(eq("hello", "hello")), fullInterp)).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════
// Boolean eq
// ═════════════════════════════════════════════════════════════════
describe("boolean eq", () => {
  test("app(eq(true,true)) adj has bool/eq, folds to true", async () => {
    const prog = app(eq(true, true));
    const kinds = Object.values(prog.__adj).map((e) => e.kind);
    expect(kinds).toContain("bool/eq");
    expect(await fold(prog, fullInterp)).toBe(true);
  });

  test("app(eq(true,false)) folds to false", async () => {
    expect(await fold(app(eq(true, false)), fullInterp)).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════
// Nested trait dispatch
// ═════════════════════════════════════════════════════════════════
describe("nested trait dispatch", () => {
  test("eq(eq(3,3), eq(5,5)) — inner num/eq, outer bool/eq → true", async () => {
    const prog = app(eq(eq(3, 3), eq(5, 5)));
    expect(await fold(prog, fullInterp)).toBe(true);
  });

  test("eq(eq(3,4), eq(5,5)) → false", async () => {
    const prog = app(eq(eq(3, 4), eq(5, 5)));
    expect(await fold(prog, fullInterp)).toBe(false);
  });

  test("nested eq adj has 3 eq nodes with correct kinds", () => {
    const prog = app(eq(eq(3, 3), eq(5, 5)));
    const eqEntries = Object.entries(prog.__adj).filter(([, e]) => e.kind.endsWith("/eq"));
    expect(eqEntries).toHaveLength(3);
    const kinds = eqEntries.map(([, e]) => e.kind).sort();
    expect(kinds).toEqual(["bool/eq", "num/eq", "num/eq"]);
  });
});

// ═════════════════════════════════════════════════════════════════
// Trait dispatch with mvfm
// ═════════════════════════════════════════════════════════════════
describe("trait dispatch with mvfm", () => {
  const $ = mvfm(numPlugin, strPlugin, boolPlugin);

  test("$.eq(3, 4) produces CExpr with kind 'eq'", () => {
    const expr = $.eq(3, 4);
    expect(expr.__kind).toBe("eq");
  });

  test("$.add(1, 2) still works", () => {
    const expr = $.add(1, 2);
    expect(expr.__kind).toBe("num/add");
  });

  test("$.eq(3,4) through full pipeline folds to false", async () => {
    const prog = app($.eq(3, 4));
    expect(await fold(prog, fullInterp)).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════
// createApp extensibility
// ═════════════════════════════════════════════════════════════════
describe("createApp extensibility", () => {
  test("createApp with stdPlugins produces same fold result as app", async () => {
    const customApp = createApp(...stdPlugins);
    const prog = customApp(eq(3, 3));
    expect(await fold(prog, fullInterp)).toBe(true);
  });

  test("createApp with ordPlugin: lt(3,5) resolves to num/lt", () => {
    const extApp = createApp(...stdPlugins, ordPlugin);
    const prog = extApp(lt(3, 5));
    const kinds = Object.values(prog.__adj).map((e) => e.kind);
    expect(kinds).toContain("num/lt");
  });

  test("ordPlugin lt(3,5) folds correctly", async () => {
    const extApp = createApp(...stdPlugins, ordPlugin);
    const prog = extApp(lt(3, 5));
    const interp = { ...fullInterp, ...ordInterp };
    expect(await fold(prog, interp)).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════
// Transform trait nodes
// ═════════════════════════════════════════════════════════════════
describe("transform trait nodes", () => {
  test("replaceWhere num/eq → num/add, fold returns 6", async () => {
    const prog = app(eq(3, 3));
    const transformed = commit(pipe(prog, (e) => replaceWhere(e, byKind("num/eq"), "num/add")));
    expect(await fold(transformed, fullInterp)).toBe(6);
  });

  test("selectWhere byKind('num/eq') finds the trait-resolved node", () => {
    const prog = app(eq(3, 3));
    const found = selectWhere(prog, byKind("num/eq"));
    expect(found.size).toBe(1);
  });

  test("replaceWhere num/eq → num/sub, fold returns 0", async () => {
    const prog = app(eq(5, 5));
    const transformed = commit(pipe(prog, (e) => replaceWhere(e, byKind("num/eq"), "num/sub")));
    expect(await fold(transformed, fullInterp)).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════
// Unified plugin defaults include eq interpreters
// ═════════════════════════════════════════════════════════════════
describe("unified plugin interpreters", () => {
  test("defaults(stdPlugins) includes num/eq handler", () => {
    const interp = defaults(stdPlugins);
    expect(interp["num/eq"]).toBeDefined();
  });

  test("defaults(stdPlugins) includes str/eq handler", () => {
    const interp = defaults(stdPlugins);
    expect(interp["str/eq"]).toBeDefined();
  });

  test("fold with defaults(stdPlugins) alone works for eq", async () => {
    const interp = defaults(stdPlugins);
    const prog = app(eq(3, 3));
    expect(await fold(prog, interp)).toBe(true);
  });
});
