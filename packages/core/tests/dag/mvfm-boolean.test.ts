/**
 * End-to-end mvfm() tests for the boolean plugin.
 * One test per build() method.
 */

import { describe, it, expect } from "vitest";
import { mvfm } from "../../src/dag/builder";
import { booleanDagPlugin } from "../../src/plugins/boolean/index";

const p = booleanDagPlugin;

describe("mvfm boolean", () => {
  it("and: true && true", async () => {
    expect(await mvfm(p, ($) => $.boolean.and($.boolean.tt(), $.boolean.tt())).eval()).toBe(true);
  });
  it("and: true && false", async () => {
    expect(await mvfm(p, ($) => $.boolean.and($.boolean.tt(), $.boolean.ff())).eval()).toBe(false);
  });
  it("or: false || true", async () => {
    expect(await mvfm(p, ($) => $.boolean.or($.boolean.ff(), $.boolean.tt())).eval()).toBe(true);
  });
  it("or: false || false", async () => {
    expect(await mvfm(p, ($) => $.boolean.or($.boolean.ff(), $.boolean.ff())).eval()).toBe(false);
  });
  it("not: true", async () => {
    expect(await mvfm(p, ($) => $.boolean.not($.boolean.tt())).eval()).toBe(false);
  });
  it("not: false", async () => {
    expect(await mvfm(p, ($) => $.boolean.not($.boolean.ff())).eval()).toBe(true);
  });
  it("eq: same", async () => {
    expect(await mvfm(p, ($) => $.boolean.eq($.boolean.tt(), $.boolean.tt())).eval()).toBe(true);
  });
  it("eq: different", async () => {
    expect(await mvfm(p, ($) => $.boolean.eq($.boolean.tt(), $.boolean.ff())).eval()).toBe(false);
  });
  it("ff", async () => {
    expect(await mvfm(p, ($) => $.boolean.ff()).eval()).toBe(false);
  });
  it("tt", async () => {
    expect(await mvfm(p, ($) => $.boolean.tt()).eval()).toBe(true);
  });
  it("implies: T -> T = T", async () => {
    expect(await mvfm(p, ($) => $.boolean.implies($.boolean.tt(), $.boolean.tt())).eval()).toBe(true);
  });
  it("implies: T -> F = F", async () => {
    expect(await mvfm(p, ($) => $.boolean.implies($.boolean.tt(), $.boolean.ff())).eval()).toBe(false);
  });
  it("implies: F -> T = T", async () => {
    expect(await mvfm(p, ($) => $.boolean.implies($.boolean.ff(), $.boolean.tt())).eval()).toBe(true);
  });
  it("show: true", async () => {
    expect(await mvfm(p, ($) => $.boolean.show($.boolean.tt())).eval()).toBe("true");
  });
  it("show: false", async () => {
    expect(await mvfm(p, ($) => $.boolean.show($.boolean.ff())).eval()).toBe("false");
  });
  it("top", async () => {
    expect(await mvfm(p, ($) => $.boolean.top()).eval()).toBe(true);
  });
  it("bottom", async () => {
    expect(await mvfm(p, ($) => $.boolean.bottom()).eval()).toBe(false);
  });
});
