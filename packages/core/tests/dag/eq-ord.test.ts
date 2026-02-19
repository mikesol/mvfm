/**
 * Tests for eq and ord DAG plugins.
 */

import { describe, it, expect } from "vitest";
import { node, mvfm } from "../../src/dag/builder";
import { app } from "../../src/dag/03-normalize";
import { fold } from "../../src/dag/fold";
import { createCoreDagInterpreter } from "../../src/dag/core-interpreter";
import { createNumDagInterpreter } from "../../src/plugins/num/interpreter";
import { createEqDagInterpreter } from "../../src/plugins/eq/interpreter";
import { createOrdDagInterpreter } from "../../src/plugins/ord/interpreter";
import { numDagPlugin } from "../../src/plugins/num/index";
import { eqDagPlugin } from "../../src/plugins/eq/index";
import { ordDagPlugin } from "../../src/plugins/ord/index";

const interp = {
  ...createCoreDagInterpreter(),
  ...createNumDagInterpreter(),
  ...createEqDagInterpreter(),
  ...createOrdDagInterpreter(),
};

describe("eq DAG interpreter", () => {
  it("eq/neq negates an eq result (true -> false)", async () => {
    const a = node<number>("core/literal", [], 3);
    const b = node<number>("core/literal", [], 3);
    const eq = node<boolean>("num/eq", [a, b]); // true
    const neq = node<boolean>("eq/neq", [eq]);
    expect(await fold(app(neq), interp)).toBe(false);
  });

  it("eq/neq negates an eq result (false -> true)", async () => {
    const a = node<number>("core/literal", [], 3);
    const b = node<number>("core/literal", [], 4);
    const eq = node<boolean>("num/eq", [a, b]); // false
    const neq = node<boolean>("eq/neq", [eq]);
    expect(await fold(app(neq), interp)).toBe(true);
  });
});

describe("ord DAG interpreter", () => {
  it("ord/gt: positive compare -> true", async () => {
    const a = node<number>("core/literal", [], 5);
    const b = node<number>("core/literal", [], 3);
    const compare = node<number>("num/compare", [a, b]); // 1
    const gt = node<boolean>("ord/gt", [compare]);
    expect(await fold(app(gt), interp)).toBe(true);
  });

  it("ord/gt: zero compare -> false", async () => {
    const a = node<number>("core/literal", [], 3);
    const b = node<number>("core/literal", [], 3);
    const compare = node<number>("num/compare", [a, b]); // 0
    const gt = node<boolean>("ord/gt", [compare]);
    expect(await fold(app(gt), interp)).toBe(false);
  });

  it("ord/gte: zero compare -> true", async () => {
    const a = node<number>("core/literal", [], 3);
    const b = node<number>("core/literal", [], 3);
    const compare = node<number>("num/compare", [a, b]); // 0
    const gte = node<boolean>("ord/gte", [compare]);
    expect(await fold(app(gte), interp)).toBe(true);
  });

  it("ord/lt: negative compare -> true", async () => {
    const a = node<number>("core/literal", [], 2);
    const b = node<number>("core/literal", [], 5);
    const compare = node<number>("num/compare", [a, b]); // -1
    const lt = node<boolean>("ord/lt", [compare]);
    expect(await fold(app(lt), interp)).toBe(true);
  });

  it("ord/lte: zero compare -> true", async () => {
    const a = node<number>("core/literal", [], 5);
    const b = node<number>("core/literal", [], 5);
    const compare = node<number>("num/compare", [a, b]); // 0
    const lte = node<boolean>("ord/lte", [compare]);
    expect(await fold(app(lte), interp)).toBe(true);
  });

  it("ord/lte: positive compare -> false", async () => {
    const a = node<number>("core/literal", [], 5);
    const b = node<number>("core/literal", [], 3);
    const compare = node<number>("num/compare", [a, b]); // 1
    const lte = node<boolean>("ord/lte", [compare]);
    expect(await fold(app(lte), interp)).toBe(false);
  });
});

describe("eq/ord via mvfm()", () => {
  it("neq via eq builder", async () => {
    const prog = mvfm([numDagPlugin, eqDagPlugin], ($: any) => {
      const eqResult = $.literal(true); // simulating an eq result
      return $.eq.neq(eqResult);
    });
    expect(await prog.eval()).toBe(false);
  });

  it("ord/gt via ord builder with num/compare", async () => {
    const prog = mvfm([numDagPlugin, ordDagPlugin], ($: any) => {
      const a = $.num.literal(10);
      const b = $.num.literal(5);
      const cmp = node<number>("num/compare", [a, b]);
      return $.ord.gt(cmp);
    });
    expect(await prog.eval()).toBe(true);
  });
});
