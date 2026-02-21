import { describe, expect, it } from "vitest";

import { defaults, foldAST, mvfm, boolean, eq, num, str } from "../../../src/index";

type Case = {
  name: string;
  build: (d: any) => unknown;
  expected: unknown;
};

const CASES: Case[] = [
  { name: "upper", build: ($) => $.upper("hello"), expected: "HELLO" },
  { name: "lower", build: ($) => $.lower("HELLO"), expected: "hello" },
  { name: "trim", build: ($) => $.trim("  hi  "), expected: "hi" },
  { name: "slice", build: ($) => $.slice("abcdef", 1, 4), expected: "bcd" },
  { name: "includes true", build: ($) => $.includes("abcdef", "bcd"), expected: true },
  { name: "startsWith true", build: ($) => $.startsWith("abcdef", "abc"), expected: true },
  { name: "endsWith false", build: ($) => $.endsWith("abcdef", "abc"), expected: false },
  { name: "split", build: ($) => $.split("a,b,c", ","), expected: ["a", "b", "c"] },
  { name: "replace", build: ($) => $.replace("a-b-c", "-", ":"), expected: "a:b-c" },
  { name: "len", build: ($) => $.len("abcdef"), expected: 6 },
  { name: "concat", build: ($) => $.concat("a", "b", "c"), expected: "abc" },
  { name: "template", build: ($) => $.str`x=${3}`, expected: "x=3" },
  { name: "eq number true", build: ($) => $.eq(5, 5), expected: true },
  { name: "eq number false", build: ($) => $.eq(5, 6), expected: false },
  { name: "eq string true", build: ($) => $.eq("a", "a"), expected: true },
  { name: "eq string false", build: ($) => $.eq("a", "b"), expected: false },
  { name: "eq bool true", build: ($) => $.eq(true, true), expected: true },
  { name: "eq bool false", build: ($) => $.eq(true, false), expected: false },
  { name: "neq bool", build: ($) => $.neq(true, false), expected: true },
  { name: "nested string+eq", build: ($) => $.eq($.upper("ab"), "AB"), expected: true },
];

describe("golden runtime: string and eq matrix", () => {
  for (const c of CASES) {
    it(c.name, async () => {
      const appWithNum = mvfm(str, boolean, num, eq);
      const prog = appWithNum(($) => c.build($));
      const result = await foldAST(defaults(appWithNum), prog);
      expect(result).toEqual(c.expected);
    });
  }
});
