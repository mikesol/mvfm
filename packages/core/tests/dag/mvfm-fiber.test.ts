/**
 * End-to-end mvfm() tests for the fiber plugin.
 * Default interpreter evaluates sequentially.
 */

import { describe, it, expect } from "vitest";
import { mvfm } from "../../src/dag/builder";
import { numDagPlugin } from "../../src/plugins/num/index";
import { fiberDagPlugin } from "../../src/plugins/fiber/index";

describe("mvfm fiber", () => {
  it("par: runs all branches", async () => {
    const r = await mvfm([numDagPlugin, fiberDagPlugin], ($) =>
      $.fiber.par($.num.literal(1), $.num.literal(2), $.num.literal(3)),
    ).eval();
    expect(r).toEqual([1, 2, 3]);
  });
  it("race: returns first result", async () => {
    const r = await mvfm([numDagPlugin, fiberDagPlugin], ($) =>
      $.fiber.race($.num.literal(10), $.num.literal(20)),
    ).eval();
    // Sequential default: first child wins
    expect(r).toBe(10);
  });
  it("seq: runs in order, returns last", async () => {
    const r = await mvfm([numDagPlugin, fiberDagPlugin], ($) =>
      $.fiber.seq($.num.literal(1), $.num.literal(2), $.num.literal(3)),
    ).eval();
    expect(r).toBe(3);
  });
});
