import { describe, expect, test } from "vitest";
import {
  app,
  boolLit,
  defaults,
  fold,
  type Interpreter,
  type RuntimeEntry,
  stdPlugins,
} from "../../src/index";

type Adj = Record<string, RuntimeEntry>;
const bool = (id: string, v: boolean): [string, RuntimeEntry] => [
  id,
  { kind: "bool/literal", children: [], out: v },
];
const num = (id: string, v: number): [string, RuntimeEntry] => [
  id,
  { kind: "num/literal", children: [], out: v },
];
const str = (id: string, v: string): [string, RuntimeEntry] => [
  id,
  { kind: "str/literal", children: [], out: v },
];
const cond = (id: string, p: string, t: string, e: string): [string, RuntimeEntry] => [
  id,
  { kind: "core/cond", children: [p, t, e], out: undefined },
];
const addN = (id: string, l: string, r: string): [string, RuntimeEntry] => [
  id,
  { kind: "num/add", children: [l, r], out: undefined },
];
const mulN = (id: string, l: string, r: string): [string, RuntimeEntry] => [
  id,
  { kind: "num/mul", children: [l, r], out: undefined },
];
const adj = (...entries: [string, RuntimeEntry][]): Adj => Object.fromEntries(entries);

const condInterp: Interpreter = {
  "bool/literal": async function* (e) {
    return e.out;
  },
  "num/literal": async function* (e) {
    return e.out;
  },
  "str/literal": async function* (e) {
    return e.out;
  },
  "core/cond": async function* () {
    const pred = (yield 0) as boolean;
    return pred ? yield 1 : yield 2;
  },
  "num/add": async function* () {
    return ((yield 0) as number) + ((yield 1) as number);
  },
  "num/mul": async function* () {
    return ((yield 0) as number) * ((yield 1) as number);
  },
};

// ─── Boolean Literals ────────────────────────────────────────────────

describe("boolean literals", () => {
  test("bool/literal true evaluates to true", async () => {
    expect(await fold<boolean>("a", adj(bool("a", true)), condInterp)).toBe(true);
  });

  test("bool/literal false evaluates to false", async () => {
    expect(await fold<boolean>("a", adj(bool("a", false)), condInterp)).toBe(false);
  });

  test("boolLit passthrough via app + fold", async () => {
    const interp = defaults(stdPlugins);
    expect(await fold(app(boolLit(true)), interp)).toBe(true);
    expect(await fold(app(boolLit(false)), interp)).toBe(false);
  });
});

// ─── Conditional (core/cond) ─────────────────────────────────────────

describe("core/cond", () => {
  test("cond(true, 10, 20) = 10", async () => {
    const a = adj(bool("p", true), num("t", 10), num("e", 20), cond("r", "p", "t", "e"));
    expect(await fold<number>("r", a, condInterp)).toBe(10);
  });

  test("cond(false, 10, 20) = 20", async () => {
    const a = adj(bool("p", false), num("t", 10), num("e", 20), cond("r", "p", "t", "e"));
    expect(await fold<number>("r", a, condInterp)).toBe(20);
  });

  test("nested cond: cond(true, cond(false, 1, 2), 3) = 2", async () => {
    const a = adj(
      bool("p1", true),
      bool("p2", false),
      num("n1", 1),
      num("n2", 2),
      num("n3", 3),
      cond("inner", "p2", "n1", "n2"),
      cond("outer", "p1", "inner", "n3"),
    );
    expect(await fold<number>("outer", a, condInterp)).toBe(2);
  });

  test("cond with arithmetic in branches: cond(true, add(3,4), 0) = 7", async () => {
    const a = adj(
      bool("p", true),
      num("n3", 3),
      num("n4", 4),
      addN("sum", "n3", "n4"),
      num("n0", 0),
      cond("r", "p", "sum", "n0"),
    );
    expect(await fold<number>("r", a, condInterp)).toBe(7);
  });

  test("short-circuit: cond(true) only evaluates then-branch", async () => {
    let thenCount = 0;
    let elseCount = 0;
    const trackInterp: Interpreter = {
      ...condInterp,
      "num/add": async function* () {
        thenCount++;
        return ((yield 0) as number) + ((yield 1) as number);
      },
      "num/mul": async function* () {
        elseCount++;
        return ((yield 0) as number) * ((yield 1) as number);
      },
    };
    const a = adj(
      bool("p", true),
      num("a", 2),
      num("b", 3),
      addN("then", "a", "b"),
      mulN("else", "a", "b"),
      cond("r", "p", "then", "else"),
    );
    expect(await fold<number>("r", a, trackInterp)).toBe(5);
    expect(thenCount).toBe(1);
    expect(elseCount).toBe(0);
  });

  test("short-circuit: cond(false) only evaluates else-branch", async () => {
    let thenCount = 0;
    let elseCount = 0;
    const trackInterp: Interpreter = {
      ...condInterp,
      "num/add": async function* () {
        thenCount++;
        return ((yield 0) as number) + ((yield 1) as number);
      },
      "num/mul": async function* () {
        elseCount++;
        return ((yield 0) as number) * ((yield 1) as number);
      },
    };
    const a = adj(
      bool("p", false),
      num("a", 2),
      num("b", 3),
      addN("then", "a", "b"),
      mulN("else", "a", "b"),
      cond("r", "p", "then", "else"),
    );
    expect(await fold<number>("r", a, trackInterp)).toBe(6);
    expect(thenCount).toBe(0);
    expect(elseCount).toBe(1);
  });

  test("cond with bool result: cond(true, true, false) = true", async () => {
    const a = adj(bool("p", true), bool("t", true), bool("f", false), cond("r", "p", "t", "f"));
    expect(await fold<boolean>("r", a, condInterp)).toBe(true);
  });

  test("cond with string result", async () => {
    const a = adj(bool("p", false), str("s1", "yes"), str("s2", "no"), cond("r", "p", "s1", "s2"));
    expect(await fold<string>("r", a, condInterp)).toBe("no");
  });
});

// ─── Begin / sequence (manual adj) ───────────────────────────────────

describe("begin/sequence", () => {
  const beginHandler: Interpreter["string"] = async function* (entry) {
    let last: unknown;
    for (let i = 0; i < entry.children.length; i++) last = yield i;
    return last;
  };
  const beginInterp: Interpreter = { ...condInterp, "core/begin": beginHandler };

  const begin = (id: string, ...kids: string[]): [string, RuntimeEntry] => [
    id,
    { kind: "core/begin", children: kids, out: undefined },
  ];

  test("begin evaluates all children, returns last", async () => {
    const a = adj(num("a", 1), num("b", 2), num("c", 3), begin("r", "a", "b", "c"));
    expect(await fold<number>("r", a, beginInterp)).toBe(3);
  });

  test("begin with side effects (counting)", async () => {
    let evalCount = 0;
    const countInterp: Interpreter = {
      "num/literal": async function* (e) {
        evalCount++;
        return e.out;
      },
      "core/begin": beginHandler,
    };
    const a = adj(num("a", 10), num("b", 20), num("c", 30), begin("r", "a", "b", "c"));
    evalCount = 0;
    expect(await fold<number>("r", a, countInterp)).toBe(30);
    expect(evalCount).toBe(3);
  });

  test("single-child begin", async () => {
    const a = adj(num("a", 42), begin("r", "a"));
    expect(await fold<number>("r", a, beginInterp)).toBe(42);
  });
});

// ─── Mixed control + arithmetic ──────────────────────────────────────

describe("mixed control + arithmetic", () => {
  test("cond feeding into arithmetic: add(cond(true, 3, 0), 4) = 7", async () => {
    const a = adj(
      bool("p", true),
      num("n3", 3),
      num("n0", 0),
      num("n4", 4),
      cond("c", "p", "n3", "n0"),
      addN("r", "c", "n4"),
    );
    expect(await fold<number>("r", a, condInterp)).toBe(7);
  });

  test("arithmetic feeding into cond predicate", async () => {
    const truthyInterp: Interpreter = {
      ...condInterp,
      "core/cond": async function* () {
        const pred = (yield 0) as number;
        return pred !== 0 ? yield 1 : yield 2;
      },
    };
    const a = adj(
      num("a", 3),
      num("b", -3),
      addN("sum", "a", "b"),
      num("yes", 100),
      num("no", 200),
      cond("r", "sum", "yes", "no"),
    );
    expect(await fold<number>("r", a, truthyInterp)).toBe(200);
  });

  test("multiple conds in one program", async () => {
    const a = adj(
      bool("t", true),
      bool("f", false),
      num("n1", 10),
      num("n2", 20),
      num("n3", 30),
      num("n4", 40),
      cond("c1", "t", "n1", "n2"),
      cond("c2", "f", "n3", "n4"),
      addN("r", "c1", "c2"),
    );
    expect(await fold<number>("r", a, condInterp)).toBe(50);
  });

  test("diamond: shared cond result used by two branches", async () => {
    const a = adj(
      bool("p", true),
      num("n5", 5),
      num("n0", 0),
      cond("s", "p", "n5", "n0"),
      addN("r", "s", "s"),
    );
    expect(await fold<number>("r", a, condInterp)).toBe(10);
  });

  test("cond result fed into mul: mul(cond(false,1,3), cond(true,7,0)) = 21", async () => {
    const a = adj(
      bool("t", true),
      bool("f", false),
      num("n0", 0),
      num("n1", 1),
      num("n3", 3),
      num("n7", 7),
      cond("c1", "f", "n1", "n3"),
      cond("c2", "t", "n7", "n0"),
      mulN("r", "c1", "c2"),
    );
    expect(await fold<number>("r", a, condInterp)).toBe(21);
  });

  test("deeply nested: cond(cond(true,true,false), 100, 200) = 100", async () => {
    const a = adj(
      bool("t", true),
      bool("f", false),
      cond("inner", "t", "t", "f"),
      num("n100", 100),
      num("n200", 200),
      cond("r", "inner", "n100", "n200"),
    );
    expect(await fold<number>("r", a, condInterp)).toBe(100);
  });

  test("begin then cond: begin(lit, cond(true,42,0)) = 42", async () => {
    const beginCondInterp: Interpreter = {
      ...condInterp,
      "core/begin": async function* (entry) {
        let last: unknown;
        for (let i = 0; i < entry.children.length; i++) last = yield i;
        return last;
      },
    };
    const a: Adj = {
      ...adj(num("ig", 999), bool("p", true), num("n42", 42), num("n0", 0)),
      ...adj(cond("c", "p", "n42", "n0")),
      r: { kind: "core/begin", children: ["ig", "c"], out: undefined },
    };
    expect(await fold<number>("r", a, beginCondInterp)).toBe(42);
  });
});
