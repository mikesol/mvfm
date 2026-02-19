/**
 * Tests for fiber DAG plugin — sequential evaluation.
 */

import { describe, it, expect } from "vitest";
import { node, mvfm } from "../../src/dag/builder";
import { app } from "../../src/dag/03-normalize";
import { fold } from "../../src/dag/fold";
import { createCoreDagInterpreter } from "../../src/dag/core-interpreter";
import { createFiberDagInterpreter } from "../../src/plugins/fiber/dag-interpreter";
import { fiberDagPlugin } from "../../src/plugins/fiber/dag-index";

const interp = {
  ...createCoreDagInterpreter(),
  ...createFiberDagInterpreter(),
};

describe("fiber DAG interpreter", () => {
  it("fiber/seq: runs steps sequentially, returns last", async () => {
    const a = node<number>("core/literal", [], 1);
    const b = node<number>("core/literal", [], 2);
    const c = node<number>("core/literal", [], 3);
    const seq = node<number>("fiber/seq", [a, b, c]);
    const expr = app(seq);
    expect(await fold(expr, interp)).toBe(3);
  });

  it("fiber/seq: single step returns that step", async () => {
    const a = node<number>("core/literal", [], 42);
    const seq = node<number>("fiber/seq", [a]);
    const expr = app(seq);
    expect(await fold(expr, interp)).toBe(42);
  });

  it("fiber/par: collects all results (sequential default)", async () => {
    const a = node<number>("core/literal", [], 1);
    const b = node<number>("core/literal", [], 2);
    const c = node<number>("core/literal", [], 3);
    const par = node<number[]>("fiber/par", [a, b, c]);
    const expr = app(par);
    expect(await fold(expr, interp)).toEqual([1, 2, 3]);
  });

  it("fiber/par: empty children returns empty array", async () => {
    const par = node<unknown[]>("fiber/par", []);
    const expr = app(par);
    expect(await fold(expr, interp)).toEqual([]);
  });

  it("fiber/race: returns first branch (sequential)", async () => {
    const a = node<number>("core/literal", [], 1);
    const b = node<number>("core/literal", [], 2);
    const race = node<number>("fiber/race", [a, b]);
    const expr = app(race);
    expect(await fold(expr, interp)).toBe(1);
  });

  it("fiber/race: throws with no branches", async () => {
    const race = node<unknown>("fiber/race", []);
    const expr = app(race);
    await expect(fold(expr, interp)).rejects.toThrow(
      "fiber/race: no branches",
    );
  });
});

describe("fiber DAG plugin via mvfm()", () => {
  it("par via builder", async () => {
    const prog = mvfm(fiberDagPlugin, ($: any) => {
      return $.fiber.par($.literal(1), $.literal(2), $.literal(3));
    });
    expect(await prog.eval()).toEqual([1, 2, 3]);
  });

  it("seq via builder", async () => {
    const prog = mvfm(fiberDagPlugin, ($: any) => {
      return $.fiber.seq($.literal(1), $.literal(2), $.literal(3));
    });
    expect(await prog.eval()).toBe(3);
  });

  it("race via builder", async () => {
    const prog = mvfm(fiberDagPlugin, ($: any) => {
      return $.fiber.race($.literal(10), $.literal(20));
    });
    expect(await prog.eval()).toBe(10);
  });
});
