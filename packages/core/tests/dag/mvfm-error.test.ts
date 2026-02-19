/**
 * End-to-end mvfm() tests for the error plugin.
 * One test per build() method.
 */

import { describe, it, expect } from "vitest";
import { mvfm } from "../../src/dag/builder";
import { numDagPlugin } from "../../src/plugins/num/index";
import { booleanDagPlugin } from "../../src/plugins/boolean/index";
import { errorDagPlugin } from "../../src/plugins/error/index";

describe("mvfm error", () => {
  it("fail: throws", async () => {
    await expect(
      mvfm([numDagPlugin, errorDagPlugin], ($) =>
        $.error.fail($.literal("boom")),
      ).eval(),
    ).rejects.toThrow("boom");
  });
  it("try: success returns value", async () => {
    const r = await mvfm([numDagPlugin, errorDagPlugin], ($) =>
      $.error.try($.num.literal(42), $.num.literal(-1)),
    ).eval();
    expect(r).toBe(42);
  });
  it("try: catch on failure", async () => {
    const r = await mvfm([numDagPlugin, errorDagPlugin], ($) =>
      $.error.try($.error.fail($.literal("boom")), $.num.literal(99)),
    ).eval();
    expect(r).toBe(99);
  });
  it("tryOnly: success passes through", async () => {
    const r = await mvfm([numDagPlugin, errorDagPlugin], ($) =>
      $.error.tryOnly($.num.literal(10)),
    ).eval();
    expect(r).toBe(10);
  });
  it("tryOnly: failure rethrows", async () => {
    await expect(
      mvfm([numDagPlugin, errorDagPlugin], ($) =>
        $.error.tryOnly($.error.fail($.literal("oops"))),
      ).eval(),
    ).rejects.toThrow("oops");
  });
  it("attempt: success", async () => {
    const r = await mvfm([numDagPlugin, errorDagPlugin], ($) =>
      $.error.attempt($.num.literal(7)),
    ).eval();
    expect(r).toEqual({ ok: 7, err: null });
  });
  it("attempt: failure", async () => {
    const r = await mvfm([numDagPlugin, errorDagPlugin], ($) =>
      $.error.attempt($.error.fail($.literal("bad"))),
    ).eval();
    expect(r).toEqual({ ok: null, err: "bad" });
  });
  it("guard: passes", async () => {
    const r = await mvfm([numDagPlugin, booleanDagPlugin, errorDagPlugin], ($) =>
      $.discard(
        $.error.guard($.boolean.tt(), $.literal("should not throw")),
        $.num.literal(1),
      ),
    ).eval();
    expect(r).toBe(1);
  });
  it("guard: throws on false", async () => {
    await expect(
      mvfm([numDagPlugin, booleanDagPlugin, errorDagPlugin], ($) =>
        $.error.guard($.boolean.ff(), $.literal("guard failed")),
      ).eval(),
    ).rejects.toThrow("guard failed");
  });
  it("settle: all succeed", async () => {
    const r = await mvfm([numDagPlugin, errorDagPlugin], ($) =>
      $.error.settle($.num.literal(1), $.num.literal(2)),
    ).eval();
    expect(r).toEqual({ fulfilled: [1, 2], rejected: [] });
  });
  it("settle: mixed results", async () => {
    const r = await mvfm([numDagPlugin, errorDagPlugin], ($) =>
      $.error.settle($.num.literal(1), $.error.fail($.literal("oops"))),
    ).eval();
    expect(r).toEqual({ fulfilled: [1], rejected: ["oops"] });
  });
});
