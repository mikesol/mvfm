/**
 * Tests for st (mutable state) DAG plugin.
 */

import { describe, it, expect } from "vitest";
import { node } from "../../src/dag/builder";
import { app } from "../../src/dag/03-normalize";
import { fold, VOLATILE_KINDS } from "../../src/dag/fold";
import { createCoreDagInterpreter } from "../../src/dag/core-interpreter";
import { createStDagInterpreter } from "../../src/plugins/st/interpreter";

describe("st DAG interpreter", () => {
  it("st/let + st/get: initialize and read", async () => {
    // Build: let x = 42, then get x
    // st/let stores ref in out, child 0 = initial value
    // st/get stores ref in out, no children (volatile)
    const init = node<number>("core/literal", [], 42);
    const letNode = node<void>("st/let", [init], "x");
    const getNode = node<number>("st/get", [], "x");
    // Need to sequence: discard(let, get)
    const seq = node<number>("core/discard", [letNode, getNode]);
    const expr = app(seq);

    const interp = {
      ...createCoreDagInterpreter(),
      ...createStDagInterpreter(),
    };
    expect(await fold(expr, interp)).toBe(42);
  });

  it("st/let + st/set + st/get: initialize, set, read", async () => {
    const init = node<number>("core/literal", [], 10);
    const letNode = node<void>("st/let", [init], "x");

    const newVal = node<number>("core/literal", [], 99);
    const setNode = node<void>("st/set", [newVal], "x");

    const getNode = node<number>("st/get", [], "x");

    // Sequence: let -> set -> get
    const step1 = node<void>("core/discard", [letNode, setNode]);
    const result = node<number>("core/discard", [step1, getNode]);
    const expr = app(result);

    const interp = {
      ...createCoreDagInterpreter(),
      ...createStDagInterpreter(),
    };
    expect(await fold(expr, interp)).toBe(99);
  });

  it("st/push appends to array", async () => {
    const init = node<number[]>("core/literal", [], [1, 2]);
    const letNode = node<void>("st/let", [init], "arr");

    const val = node<number>("core/literal", [], 3);
    const pushNode = node<void>("st/push", [val], "arr");

    const getNode = node<unknown>("st/get", [], "arr");

    const step1 = node<void>("core/discard", [letNode, pushNode]);
    const result = node<unknown>("core/discard", [step1, getNode]);
    const expr = app(result);

    const interp = {
      ...createCoreDagInterpreter(),
      ...createStDagInterpreter(),
    };
    expect(await fold(expr, interp)).toEqual([1, 2, 3]);
  });

  it("st/get is volatile (always re-evaluates)", () => {
    expect(VOLATILE_KINDS.has("st/get")).toBe(true);
  });

  it("st/get throws for unknown ref", async () => {
    const getNode = node<unknown>("st/get", [], "unknown_ref");
    const expr = app(getNode);

    const interp = {
      ...createCoreDagInterpreter(),
      ...createStDagInterpreter(),
    };
    await expect(fold(expr, interp)).rejects.toThrow(
      'st/get: unknown ref "unknown_ref"',
    );
  });

  it("st/set throws for unknown ref", async () => {
    const val = node<number>("core/literal", [], 42);
    const setNode = node<void>("st/set", [val], "unknown_ref");
    const expr = app(setNode);

    const interp = {
      ...createCoreDagInterpreter(),
      ...createStDagInterpreter(),
    };
    await expect(fold(expr, interp)).rejects.toThrow(
      'st/set: unknown ref "unknown_ref"',
    );
  });

  it("st/push throws for non-array ref", async () => {
    const init = node<number>("core/literal", [], 42);
    const letNode = node<void>("st/let", [init], "x");

    const val = node<number>("core/literal", [], 1);
    const pushNode = node<void>("st/push", [val], "x");

    const seq = node<void>("core/discard", [letNode, pushNode]);
    const expr = app(seq);

    const interp = {
      ...createCoreDagInterpreter(),
      ...createStDagInterpreter(),
    };
    await expect(fold(expr, interp)).rejects.toThrow(
      'st/push: ref "x" is not an array',
    );
  });

  it("each createStDagInterpreter() call gets fresh store", async () => {
    const init = node<number>("core/literal", [], 1);
    const letNode = node<void>("st/let", [init], "x");
    const getNode = node<number>("st/get", [], "x");
    const seq = node<number>("core/discard", [letNode, getNode]);
    const expr = app(seq);

    const interp1 = {
      ...createCoreDagInterpreter(),
      ...createStDagInterpreter(),
    };
    const interp2 = {
      ...createCoreDagInterpreter(),
      ...createStDagInterpreter(),
    };
    expect(await fold(expr, interp1)).toBe(1);
    expect(await fold(expr, interp2)).toBe(1);
  });
});
