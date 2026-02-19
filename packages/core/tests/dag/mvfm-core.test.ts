/**
 * End-to-end mvfm() tests for core operations (literal, cond, discard).
 */

import { describe, it, expect } from "vitest";
import { mvfm } from "../../src/dag/builder";
import { numDagPlugin } from "../../src/plugins/num/index";
import { booleanDagPlugin } from "../../src/plugins/boolean/index";

describe("mvfm core", () => {
  it("literal: number", async () => {
    expect(await mvfm(numDagPlugin, ($) => $.literal(42)).eval()).toBe(42);
  });
  it("literal: string", async () => {
    expect(await mvfm(numDagPlugin, ($) => $.literal("hello")).eval()).toBe("hello");
  });
  it("literal: boolean", async () => {
    expect(await mvfm(numDagPlugin, ($) => $.literal(true)).eval()).toBe(true);
  });
  it("literal: object", async () => {
    expect(await mvfm(numDagPlugin, ($) => $.literal({ a: 1 })).eval()).toEqual({ a: 1 });
  });
  it("literal: array", async () => {
    expect(await mvfm(numDagPlugin, ($) => $.literal([1, 2, 3])).eval()).toEqual([1, 2, 3]);
  });
  it("cond: true branch", async () => {
    const r = await mvfm([numDagPlugin, booleanDagPlugin], ($) =>
      $.cond($.boolean.tt(), $.num.literal(1), $.num.literal(2)),
    ).eval();
    expect(r).toBe(1);
  });
  it("cond: false branch", async () => {
    const r = await mvfm([numDagPlugin, booleanDagPlugin], ($) =>
      $.cond($.boolean.ff(), $.num.literal(1), $.num.literal(2)),
    ).eval();
    expect(r).toBe(2);
  });
  it("discard: evaluates side effect, returns result", async () => {
    const r = await mvfm(numDagPlugin, ($) =>
      $.discard($.num.literal(999), $.num.literal(42)),
    ).eval();
    expect(r).toBe(42);
  });
  it("discard: chains (begin pattern)", async () => {
    const r = await mvfm(numDagPlugin, ($) =>
      $.discard($.num.literal(1), $.discard($.num.literal(2), $.num.literal(3))),
    ).eval();
    expect(r).toBe(3);
  });
});
