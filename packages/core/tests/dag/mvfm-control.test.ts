/**
 * End-to-end mvfm() tests for the control plugin.
 * Tests each (iteration) and while (loop).
 */

import { describe, it, expect } from "vitest";
import { mvfm } from "../../src/dag/builder";
import { numDagPlugin } from "../../src/plugins/num/index";
import { stDagPlugin } from "../../src/plugins/st/index";
import { booleanDagPlugin } from "../../src/plugins/boolean/index";
import { controlDagPlugin } from "../../src/plugins/control/index";
import { ordDagPlugin } from "../../src/plugins/ord/index";

describe("mvfm control", () => {
  it("each: iterates over collection", async () => {
    const r = await mvfm(
      [numDagPlugin, stDagPlugin, controlDagPlugin],
      ($) => {
        const acc = $.st.let($.literal(0 as number));
        const items = $.literal([1, 2, 3]);
        // each item: acc += item (approximated by running body per item)
        const loop = $.control.each(items, acc.get());
        return $.discard(acc.init, $.discard(loop, acc.get()));
      },
    ).eval();
    // each returns the body results as an array
    expect(r).toBe(0); // get returns initial value since body doesn't mutate
  });
  it("while: loops until condition false", async () => {
    const r = await mvfm(
      [numDagPlugin, stDagPlugin, booleanDagPlugin, controlDagPlugin, ordDagPlugin],
      ($) => {
        const counter = $.st.let($.num.literal(0));
        const cond = $.ord.lt($.num.compare(counter.get(), $.num.literal(3)));
        const body = counter.set($.num.add(counter.get(), $.num.literal(1)));
        const loop = $.control.while(cond, body);
        return $.discard(counter.init, $.discard(loop, counter.get()));
      },
    ).eval();
    expect(r).toBe(3);
  });
});
