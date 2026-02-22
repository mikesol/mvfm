import { describe, expect, test } from "vitest";
import {
  add,
  app,
  boolPlugin,
  byKind,
  byName,
  commit,
  defaults,
  dirty,
  fold,
  gc,
  type Interpreter,
  isLeaf,
  mul,
  mvfmU,
  name,
  numLit,
  numPlugin,
  pipe,
  replaceWhere,
  selectWhere,
  spliceWhere,
  stdPlugins,
  strPlugin,
  sub,
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
// Calculator programs
// =====================================================================
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
    const prog = app(
      sub(
        mul(add(numLit(1), numLit(2)), add(numLit(3), numLit(4))),
        mul(add(numLit(5), numLit(6)), add(numLit(7), numLit(8))),
      ),
    );
    expect(await fold(prog, numInterp)).toBe(3 * 7 - 11 * 15);
  });

  test("transform add->mul via dagql then fold", async () => {
    const prog = app($.mul($.add(2, 3), 4));
    const transformed = pipe(prog, (e) => replaceWhere(e, byKind("num/add"), "num/mul"));
    expect(await fold(commit(transformed), numInterp)).toBe(24);
  });

  test("transform mul->add then fold", async () => {
    const prog = app($.mul($.add(2, 3), 4));
    const transformed = pipe(prog, (e) => replaceWhere(e, byKind("num/mul"), "num/add"));
    expect(await fold(commit(transformed), numInterp)).toBe(9);
  });
});

// =====================================================================
// Trait dispatch pipeline
// =====================================================================
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
    const literals = selectWhere(prog, byKind("num/literal"));
    expect(literals.size).toBe(2);
  });
});

// =====================================================================
// DAG transform pipeline
// =====================================================================
describe("DAG transform pipeline", () => {
  test("app -> pipe(replace, splice) -> fold", async () => {
    const prog = app(mul(add(numLit(3), numLit(4)), numLit(5)));
    const transformed = pipe(
      prog,
      (e) => replaceWhere(e, byKind("num/add"), "num/sub"),
      (e) => spliceWhere(commit(e), isLeaf()),
    );
    expect(Object.keys(transformed.__adj).length).toBe(2);
  });

  test("app -> pipe(replace, replace) -> fold", async () => {
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
    const named = name(prog, "myAdd", "c");
    const aliases = selectWhere(named, byName("myAdd"));
    expect(aliases.size).toBe(1);
    const transformed = pipe(named, (e) => replaceWhere(e, byKind("num/add"), "num/sub"));
    expect(await fold(commit(transformed), numInterp)).toBe(-5);
  });

  test("multiple pipe steps then fold", async () => {
    const prog = app($.mul($.add(1, 2), $.add(3, 4)));
    const transformed = pipe(
      prog,
      (e) => replaceWhere(e, byKind("num/add"), "num/sub"),
      (e) => replaceWhere(e, byKind("num/mul"), "num/add"),
    );
    expect(await fold(commit(transformed), numInterp)).toBe(-2);
  });
});
