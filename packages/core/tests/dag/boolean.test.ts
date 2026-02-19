/**
 * Tests for boolean DAG plugin — interpreter and builder.
 */

import { describe, it, expect } from "vitest";
import { node, mvfm } from "../../src/dag/builder";
import { app } from "../../src/dag/03-normalize";
import { fold } from "../../src/dag/fold";
import { createCoreDagInterpreter } from "../../src/dag/core-interpreter";
import { createBooleanDagInterpreter } from "../../src/plugins/boolean/dag-interpreter";
import { booleanDagPlugin } from "../../src/plugins/boolean/dag-index";

const interp = {
  ...createCoreDagInterpreter(),
  ...createBooleanDagInterpreter(),
};

describe("boolean DAG interpreter", () => {
  it("boolean/and: true && true = true", async () => {
    const a = node<boolean>("core/literal", [], true);
    const b = node<boolean>("core/literal", [], true);
    const and = node<boolean>("boolean/and", [a, b]);
    expect(await fold(app(and), interp)).toBe(true);
  });

  it("boolean/and: true && false = false", async () => {
    const a = node<boolean>("core/literal", [], true);
    const b = node<boolean>("core/literal", [], false);
    const and = node<boolean>("boolean/and", [a, b]);
    expect(await fold(app(and), interp)).toBe(false);
  });

  it("boolean/and short-circuits on false", async () => {
    let rightEvaluated = false;
    const a = node<boolean>("core/literal", [], false);
    const b = node<boolean>("core/literal", [], true);
    const and = node<boolean>("boolean/and", [a, b]);
    const expr = app(and);

    const customInterp = {
      ...interp,
      "core/literal": async function* (
        entry: { out: unknown },
      ): AsyncGenerator<number, unknown, unknown> {
        if (entry.out === true) rightEvaluated = true;
        return entry.out;
      },
    };
    expect(await fold(expr, customInterp)).toBe(false);
    expect(rightEvaluated).toBe(false);
  });

  it("boolean/or: false || true = true", async () => {
    const a = node<boolean>("core/literal", [], false);
    const b = node<boolean>("core/literal", [], true);
    const or = node<boolean>("boolean/or", [a, b]);
    expect(await fold(app(or), interp)).toBe(true);
  });

  it("boolean/or short-circuits on true", async () => {
    let rightEvaluated = false;
    const a = node<boolean>("core/literal", [], true);
    const b = node<boolean>("core/literal", [], false);
    const or = node<boolean>("boolean/or", [a, b]);
    const expr = app(or);

    const customInterp = {
      ...interp,
      "core/literal": async function* (
        entry: { out: unknown },
      ): AsyncGenerator<number, unknown, unknown> {
        if (entry.out === false) rightEvaluated = true;
        return entry.out;
      },
    };
    expect(await fold(expr, customInterp)).toBe(true);
    expect(rightEvaluated).toBe(false);
  });

  it("boolean/not: !true = false", async () => {
    const a = node<boolean>("core/literal", [], true);
    const not = node<boolean>("boolean/not", [a]);
    expect(await fold(app(not), interp)).toBe(false);
  });

  it("boolean/eq: true === true", async () => {
    const a = node<boolean>("core/literal", [], true);
    const b = node<boolean>("core/literal", [], true);
    const eq = node<boolean>("boolean/eq", [a, b]);
    expect(await fold(app(eq), interp)).toBe(true);
  });

  it("boolean/eq: true !== false", async () => {
    const a = node<boolean>("core/literal", [], true);
    const b = node<boolean>("core/literal", [], false);
    const eq = node<boolean>("boolean/eq", [a, b]);
    expect(await fold(app(eq), interp)).toBe(false);
  });

  it("boolean/ff returns false", async () => {
    const ff = node<boolean>("boolean/ff", []);
    expect(await fold(app(ff), interp)).toBe(false);
  });

  it("boolean/tt returns true", async () => {
    const tt = node<boolean>("boolean/tt", []);
    expect(await fold(app(tt), interp)).toBe(true);
  });

  it("boolean/implies: false => anything = true", async () => {
    const a = node<boolean>("core/literal", [], false);
    const b = node<boolean>("core/literal", [], false);
    const imp = node<boolean>("boolean/implies", [a, b]);
    expect(await fold(app(imp), interp)).toBe(true);
  });

  it("boolean/implies: true => false = false", async () => {
    const a = node<boolean>("core/literal", [], true);
    const b = node<boolean>("core/literal", [], false);
    const imp = node<boolean>("boolean/implies", [a, b]);
    expect(await fold(app(imp), interp)).toBe(false);
  });

  it("boolean/show converts to string", async () => {
    const a = node<boolean>("core/literal", [], true);
    const show = node<string>("boolean/show", [a]);
    expect(await fold(app(show), interp)).toBe("true");
  });

  it("boolean/top returns true", async () => {
    const top = node<boolean>("boolean/top", []);
    expect(await fold(app(top), interp)).toBe(true);
  });

  it("boolean/bottom returns false", async () => {
    const bottom = node<boolean>("boolean/bottom", []);
    expect(await fold(app(bottom), interp)).toBe(false);
  });
});

describe("boolean DAG plugin via mvfm()", () => {
  it("and via builder", async () => {
    const prog = mvfm(booleanDagPlugin, ($: any) => {
      return $.boolean.and($.literal(true), $.literal(false));
    });
    expect(await prog.eval()).toBe(false);
  });

  it("or via builder", async () => {
    const prog = mvfm(booleanDagPlugin, ($: any) => {
      return $.boolean.or($.literal(false), $.literal(true));
    });
    expect(await prog.eval()).toBe(true);
  });

  it("not via builder", async () => {
    const prog = mvfm(booleanDagPlugin, ($: any) => {
      return $.boolean.not($.literal(true));
    });
    expect(await prog.eval()).toBe(false);
  });

  it("tt and ff leaf nodes via builder", async () => {
    const prog = mvfm(booleanDagPlugin, ($: any) => {
      return $.boolean.and($.boolean.tt(), $.boolean.ff());
    });
    expect(await prog.eval()).toBe(false);
  });
});
