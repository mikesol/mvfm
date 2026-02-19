/**
 * End-to-end mvfm() tests for the num plugin.
 * One test per build() method, exercising build + node + app + fold.
 */

import { describe, it, expect } from "vitest";
import { mvfm } from "../../src/dag/builder";
import { numDagPlugin } from "../../src/plugins/num/index";

const p = numDagPlugin;

describe("mvfm num", () => {
  it("literal", async () => {
    expect(await mvfm(p, ($) => $.num.literal(42)).eval()).toBe(42);
  });
  it("add", async () => {
    expect(await mvfm(p, ($) => $.num.add($.num.literal(3), $.num.literal(4))).eval()).toBe(7);
  });
  it("sub", async () => {
    expect(await mvfm(p, ($) => $.num.sub($.num.literal(10), $.num.literal(3))).eval()).toBe(7);
  });
  it("mul", async () => {
    expect(await mvfm(p, ($) => $.num.mul($.num.literal(6), $.num.literal(7))).eval()).toBe(42);
  });
  it("div", async () => {
    expect(await mvfm(p, ($) => $.num.div($.num.literal(20), $.num.literal(4))).eval()).toBe(5);
  });
  it("mod", async () => {
    expect(await mvfm(p, ($) => $.num.mod($.num.literal(10), $.num.literal(3))).eval()).toBe(1);
  });
  it("compare: less", async () => {
    expect(await mvfm(p, ($) => $.num.compare($.num.literal(1), $.num.literal(5))).eval()).toBe(-1);
  });
  it("compare: equal", async () => {
    expect(await mvfm(p, ($) => $.num.compare($.num.literal(3), $.num.literal(3))).eval()).toBe(0);
  });
  it("compare: greater", async () => {
    expect(await mvfm(p, ($) => $.num.compare($.num.literal(9), $.num.literal(2))).eval()).toBe(1);
  });
  it("neg", async () => {
    expect(await mvfm(p, ($) => $.num.neg($.num.literal(5))).eval()).toBe(-5);
  });
  it("abs", async () => {
    expect(await mvfm(p, ($) => $.num.abs($.num.literal(-7))).eval()).toBe(7);
  });
  it("floor", async () => {
    expect(await mvfm(p, ($) => $.num.floor($.num.literal(3.7))).eval()).toBe(3);
  });
  it("ceil", async () => {
    expect(await mvfm(p, ($) => $.num.ceil($.num.literal(3.2))).eval()).toBe(4);
  });
  it("round", async () => {
    expect(await mvfm(p, ($) => $.num.round($.num.literal(3.5))).eval()).toBe(4);
  });
  it("min", async () => {
    expect(await mvfm(p, ($) => $.num.min($.num.literal(5), $.num.literal(2), $.num.literal(8))).eval()).toBe(2);
  });
  it("max", async () => {
    expect(await mvfm(p, ($) => $.num.max($.num.literal(5), $.num.literal(2), $.num.literal(8))).eval()).toBe(8);
  });
  it("eq: true", async () => {
    expect(await mvfm(p, ($) => $.num.eq($.num.literal(5), $.num.literal(5))).eval()).toBe(true);
  });
  it("eq: false", async () => {
    expect(await mvfm(p, ($) => $.num.eq($.num.literal(5), $.num.literal(3))).eval()).toBe(false);
  });
  it("zero", async () => {
    expect(await mvfm(p, ($) => $.num.zero()).eval()).toBe(0);
  });
  it("one", async () => {
    expect(await mvfm(p, ($) => $.num.one()).eval()).toBe(1);
  });
  it("show", async () => {
    expect(await mvfm(p, ($) => $.num.show($.num.literal(42))).eval()).toBe("42");
  });
  it("top", async () => {
    expect(await mvfm(p, ($) => $.num.top()).eval()).toBe(Infinity);
  });
  it("bottom", async () => {
    expect(await mvfm(p, ($) => $.num.bottom()).eval()).toBe(-Infinity);
  });
});
