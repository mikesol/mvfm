import { describe, expect, it } from "vitest";

import { runWithDefaults } from "../shared/case-runner";
import { buildMathApp } from "../shared/case-builders";

type NumCase = {
  name: string;
  build: (d: ReturnType<typeof buildMathApp> extends (fn: infer F) => any ? Parameters<F>[0] : never) => unknown;
  expected: number;
};

const CASES: NumCase[] = [
  { name: "add 1+2", build: ($: any) => $.add(1, 2), expected: 3 },
  { name: "mul 3*4", build: ($: any) => $.mul(3, 4), expected: 12 },
  { name: "nested (3+4)*5", build: ($: any) => $.mul($.add(3, 4), 5), expected: 35 },
  { name: "sub 9-2", build: ($: any) => $.sub(9, 2), expected: 7 },
  { name: "div 20/5", build: ($: any) => $.div(20, 5), expected: 4 },
  { name: "mod 20%6", build: ($: any) => $.mod(20, 6), expected: 2 },
  { name: "neg -5", build: ($: any) => $.neg(5), expected: -5 },
  { name: "abs |-7|", build: ($: any) => $.abs(-7), expected: 7 },
  { name: "floor 2.9", build: ($: any) => $.floor(2.9), expected: 2 },
  { name: "ceil 2.1", build: ($: any) => $.ceil(2.1), expected: 3 },
  { name: "round 2.6", build: ($: any) => $.round(2.6), expected: 3 },
  { name: "min", build: ($: any) => $.min(7, 3, 5), expected: 3 },
  { name: "max", build: ($: any) => $.max(7, 3, 5), expected: 7 },
  { name: "assoc add left", build: ($: any) => $.add($.add(1, 2), 3), expected: 6 },
  { name: "assoc add right", build: ($: any) => $.add(1, $.add(2, 3)), expected: 6 },
  { name: "mul distributes over add", build: ($: any) => $.mul(2, $.add(3, 4)), expected: 14 },
  { name: "double neg", build: ($: any) => $.neg($.neg(9)), expected: 9 },
  { name: "complex 1", build: ($: any) => $.sub($.mul($.add(2, 3), 4), 6), expected: 14 },
  { name: "complex 2", build: ($: any) => $.div($.mul(9, 8), $.add(3, 3)), expected: 12 },
  { name: "complex 3", build: ($: any) => $.add($.mod(41, 6), $.abs(-3)), expected: 8 },
];

describe("golden runtime: arithmetic matrix", () => {
  for (const c of CASES) {
    it(c.name, async () => {
      const app = buildMathApp();
      const prog = app(($: any) => c.build($));
      const result = await runWithDefaults(app, prog as never);
      expect(result).toBe(c.expected);
    });
  }
});
