/**
 * End-to-end mvfm() tests for the st (mutable state) plugin.
 * The st API uses a let/handle pattern: $.st.let(initial) returns
 * { init, get(), set(v), push(v), ref }.
 */

import { describe, it, expect } from "vitest";
import { mvfm } from "../../src/dag/builder";
import { numDagPlugin } from "../../src/plugins/num/index";
import { stDagPlugin } from "../../src/plugins/st/index";

describe("mvfm st", () => {
  it("let + get: read initial value", async () => {
    const r = await mvfm([numDagPlugin, stDagPlugin], ($) => {
      const x = $.st.let($.num.literal(42));
      return $.discard(x.init, x.get());
    }).eval();
    expect(r).toBe(42);
  });
  it("let + set + get: update value", async () => {
    const r = await mvfm([numDagPlugin, stDagPlugin], ($) => {
      const x = $.st.let($.num.literal(1));
      const setTo99 = x.set($.num.literal(99));
      return $.discard(x.init, $.discard(setTo99, x.get()));
    }).eval();
    expect(r).toBe(99);
  });
  it("let + push + get: append to array", async () => {
    const r = await mvfm([numDagPlugin, stDagPlugin], ($) => {
      const arr = $.st.let($.literal([] as number[]));
      const p1 = arr.push($.num.literal(1));
      const p2 = arr.push($.num.literal(2));
      return $.discard(arr.init, $.discard(p1, $.discard(p2, arr.get())));
    }).eval();
    expect(r).toEqual([1, 2]);
  });
  it("custom ref name", async () => {
    const r = await mvfm([numDagPlugin, stDagPlugin], ($) => {
      const x = $.st.let($.num.literal(7), "myVar");
      return $.discard(x.init, x.get());
    }).eval();
    expect(r).toBe(7);
  });
});
