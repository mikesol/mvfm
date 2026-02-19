/**
 * End-to-end mvfm() tests for the eq and ord plugins.
 * eq only has neq (eq dispatch is on type-specific plugins like num/eq, str/eq).
 * ord derives comparisons from a compare result.
 */

import { describe, it, expect } from "vitest";
import { mvfm } from "../../src/dag/builder";
import { numDagPlugin } from "../../src/plugins/num/index";
import { eqDagPlugin } from "../../src/plugins/eq/index";
import { ordDagPlugin } from "../../src/plugins/ord/index";

describe("mvfm eq", () => {
  it("neq: different values", async () => {
    const r = await mvfm([numDagPlugin, eqDagPlugin], ($) =>
      $.eq.neq($.num.eq($.num.literal(3), $.num.literal(5))),
    ).eval();
    expect(r).toBe(true); // 3 != 5
  });
  it("neq: same values", async () => {
    const r = await mvfm([numDagPlugin, eqDagPlugin], ($) =>
      $.eq.neq($.num.eq($.num.literal(5), $.num.literal(5))),
    ).eval();
    expect(r).toBe(false); // !(5 == 5) = false
  });
});

describe("mvfm ord", () => {
  it("gt: true", async () => {
    const r = await mvfm([numDagPlugin, ordDagPlugin], ($) =>
      $.ord.gt($.num.compare($.num.literal(5), $.num.literal(3))),
    ).eval();
    expect(r).toBe(true);
  });
  it("gt: false", async () => {
    const r = await mvfm([numDagPlugin, ordDagPlugin], ($) =>
      $.ord.gt($.num.compare($.num.literal(3), $.num.literal(5))),
    ).eval();
    expect(r).toBe(false);
  });
  it("gte: equal", async () => {
    const r = await mvfm([numDagPlugin, ordDagPlugin], ($) =>
      $.ord.gte($.num.compare($.num.literal(5), $.num.literal(5))),
    ).eval();
    expect(r).toBe(true);
  });
  it("lt: true", async () => {
    const r = await mvfm([numDagPlugin, ordDagPlugin], ($) =>
      $.ord.lt($.num.compare($.num.literal(1), $.num.literal(9))),
    ).eval();
    expect(r).toBe(true);
  });
  it("lte: equal", async () => {
    const r = await mvfm([numDagPlugin, ordDagPlugin], ($) =>
      $.ord.lte($.num.compare($.num.literal(7), $.num.literal(7))),
    ).eval();
    expect(r).toBe(true);
  });
  it("lte: greater", async () => {
    const r = await mvfm([numDagPlugin, ordDagPlugin], ($) =>
      $.ord.lte($.num.compare($.num.literal(9), $.num.literal(1))),
    ).eval();
    expect(r).toBe(false);
  });
});
