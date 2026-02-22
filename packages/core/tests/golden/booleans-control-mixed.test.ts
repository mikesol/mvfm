import { describe, expect, test } from "vitest";
import { fold, type Interpreter, type RuntimeEntry } from "../../src/index";

type Adj = Record<string, RuntimeEntry>;
const bool = (id: string, v: boolean): [string, RuntimeEntry] => [
  id,
  { kind: "bool/literal", children: [], out: v },
];
const num = (id: string, v: number): [string, RuntimeEntry] => [
  id,
  { kind: "num/literal", children: [], out: v },
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

// --- Mixed control + arithmetic ---

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
