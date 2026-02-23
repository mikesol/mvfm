import type { CExpr } from "../src/expr";
import type { Liftable } from "../src/liftable";

// Primitives: accept plain or CExpr
type L1 = Liftable<string>;
const _s1: L1 = "hello";
const _s2: L1 = {} as CExpr<string>;

type L2 = Liftable<number>;
const _n1: L2 = 42;
const _n2: L2 = {} as CExpr<number>;

// Null/undefined pass through
type L3 = Liftable<null>;
const _null: L3 = null;

// Object: each field is liftable
type Obj = { model: string; temperature?: number };
type L4 = Liftable<Obj>;
const _o1: L4 = { model: "gpt-4o" };
const _o2: L4 = { model: {} as CExpr<string> };
const _o3: L4 = { model: "gpt-4o", temperature: {} as CExpr<number> };
// Whole object as CExpr
const _o4: L4 = {} as CExpr<Obj>;

// Array: elements are liftable
type L5 = Liftable<string[]>;
const _a1: L5 = ["hello"];
const _a2: L5 = [{} as CExpr<string>];

// Nested object
type Nested = { messages: Array<{ role: string; content: string }> };
type L6 = Liftable<Nested>;
const _nested: L6 = {
  messages: [{ role: "user", content: {} as CExpr<string> }],
};

// @ts-expect-error - wrong type in field
const _bad: L4 = { model: 42 };
