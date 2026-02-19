/**
 * End-to-end mvfm() tests for the str plugin.
 * One test per build() method.
 */

import { describe, it, expect } from "vitest";
import { mvfm } from "../../src/dag/builder";
import { strDagPlugin } from "../../src/plugins/str/index";
import { numDagPlugin } from "../../src/plugins/num/index";

const p = strDagPlugin;

describe("mvfm str", () => {
  it("literal", async () => {
    expect(await mvfm(p, ($) => $.str.literal("hello")).eval()).toBe("hello");
  });
  it("concat", async () => {
    expect(
      await mvfm(p, ($) => $.str.concat($.str.literal("a"), $.str.literal("b"), $.str.literal("c"))).eval(),
    ).toBe("abc");
  });
  it("template", async () => {
    expect(
      await mvfm([p, numDagPlugin], ($) =>
        $.str.template(["Hello ", "! You are ", " years old."], $.str.literal("Alice"), $.num.literal(30)),
      ).eval(),
    ).toBe("Hello Alice! You are 30 years old.");
  });
  it("upper", async () => {
    expect(await mvfm(p, ($) => $.str.upper($.str.literal("hello"))).eval()).toBe("HELLO");
  });
  it("lower", async () => {
    expect(await mvfm(p, ($) => $.str.lower($.str.literal("HELLO"))).eval()).toBe("hello");
  });
  it("trim", async () => {
    expect(await mvfm(p, ($) => $.str.trim($.str.literal("  hi  "))).eval()).toBe("hi");
  });
  it("slice with start and end", async () => {
    expect(
      await mvfm([p, numDagPlugin], ($) =>
        $.str.slice($.str.literal("hello world"), $.num.literal(0), $.num.literal(5)),
      ).eval(),
    ).toBe("hello");
  });
  it("slice with start only", async () => {
    expect(
      await mvfm([p, numDagPlugin], ($) =>
        $.str.slice($.str.literal("hello world"), $.num.literal(6)),
      ).eval(),
    ).toBe("world");
  });
  it("includes: true", async () => {
    expect(
      await mvfm(p, ($) => $.str.includes($.str.literal("hello world"), $.str.literal("world"))).eval(),
    ).toBe(true);
  });
  it("includes: false", async () => {
    expect(
      await mvfm(p, ($) => $.str.includes($.str.literal("hello"), $.str.literal("xyz"))).eval(),
    ).toBe(false);
  });
  it("startsWith", async () => {
    expect(
      await mvfm(p, ($) => $.str.startsWith($.str.literal("hello"), $.str.literal("hel"))).eval(),
    ).toBe(true);
  });
  it("endsWith", async () => {
    expect(
      await mvfm(p, ($) => $.str.endsWith($.str.literal("hello"), $.str.literal("llo"))).eval(),
    ).toBe(true);
  });
  it("split", async () => {
    expect(
      await mvfm(p, ($) => $.str.split($.str.literal("a,b,c"), $.str.literal(","))).eval(),
    ).toEqual(["a", "b", "c"]);
  });
  it("join", async () => {
    // join takes an array expr and a separator expr
    // We need a literal array — use core literal for that
    expect(
      await mvfm(p, ($) => $.str.join($.literal(["a", "b", "c"]), $.str.literal("-"))).eval(),
    ).toBe("a-b-c");
  });
  it("replace", async () => {
    expect(
      await mvfm(p, ($) =>
        $.str.replace($.str.literal("hello world"), $.str.literal("world"), $.str.literal("earth")),
      ).eval(),
    ).toBe("hello earth");
  });
  it("len", async () => {
    expect(await mvfm(p, ($) => $.str.len($.str.literal("hello"))).eval()).toBe(5);
  });
  it("eq: true", async () => {
    expect(await mvfm(p, ($) => $.str.eq($.str.literal("a"), $.str.literal("a"))).eval()).toBe(true);
  });
  it("eq: false", async () => {
    expect(await mvfm(p, ($) => $.str.eq($.str.literal("a"), $.str.literal("b"))).eval()).toBe(false);
  });
  it("show", async () => {
    expect(await mvfm(p, ($) => $.str.show($.str.literal("hi"))).eval()).toBe("hi");
  });
  it("append", async () => {
    expect(
      await mvfm(p, ($) => $.str.append($.str.literal("foo"), $.str.literal("bar"))).eval(),
    ).toBe("foobar");
  });
  it("mempty", async () => {
    expect(await mvfm(p, ($) => $.str.mempty()).eval()).toBe("");
  });
});
