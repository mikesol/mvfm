/**
 * Tests for core DAG behavior — literals, cond, discard, sharing, memoization.
 */

import { describe, it, expect } from "vitest";
import { node } from "../../src/dag/builder";
import { app } from "../../src/dag/03-normalize";
import { fold } from "../../src/dag/fold";
import { createCoreDagInterpreter } from "../../src/dag/core-interpreter";

const interp = createCoreDagInterpreter();

describe("core/literal", () => {
  it("evaluates number", async () => {
    const lit = node<number>("core/literal", [], 42);
    expect(await fold(app(lit), interp)).toBe(42);
  });

  it("evaluates string", async () => {
    const lit = node<string>("core/literal", [], "hello");
    expect(await fold(app(lit), interp)).toBe("hello");
  });

  it("evaluates boolean", async () => {
    const lit = node<boolean>("core/literal", [], true);
    expect(await fold(app(lit), interp)).toBe(true);
  });

  it("evaluates undefined for null (null coalesces to undefined in node())", async () => {
    const lit = node<null>("core/literal", [], null);
    // node() uses `out ?? undefined`, so null becomes undefined
    expect(await fold(app(lit), interp)).toBe(undefined);
  });

  it("evaluates object", async () => {
    const obj = { a: 1, b: "two" };
    const lit = node<typeof obj>("core/literal", [], obj);
    expect(await fold(app(lit), interp)).toEqual(obj);
  });

  it("evaluates array", async () => {
    const arr = [1, 2, 3];
    const lit = node<typeof arr>("core/literal", [], arr);
    expect(await fold(app(lit), interp)).toEqual(arr);
  });
});

describe("core/cond", () => {
  it("evaluates then branch when predicate is true", async () => {
    const pred = node<boolean>("core/literal", [], true);
    const then_ = node<string>("core/literal", [], "yes");
    const else_ = node<string>("core/literal", [], "no");
    const cond = node<string>("core/cond", [pred, then_, else_]);
    expect(await fold(app(cond), interp)).toBe("yes");
  });

  it("evaluates else branch when predicate is false", async () => {
    const pred = node<boolean>("core/literal", [], false);
    const then_ = node<string>("core/literal", [], "yes");
    const else_ = node<string>("core/literal", [], "no");
    const cond = node<string>("core/cond", [pred, then_, else_]);
    expect(await fold(app(cond), interp)).toBe("no");
  });

  it("short-circuits: does not evaluate unused branch", async () => {
    let elseEvaluated = false;
    const pred = node<boolean>("core/literal", [], true);
    const then_ = node<string>("core/literal", [], "yes");
    const else_ = node<string>("core/literal", [], "no");
    const cond = node<string>("core/cond", [pred, then_, else_]);
    const expr = app(cond);

    const customInterp = {
      ...interp,
      "core/literal": async function* (
        entry: { out: unknown },
      ): AsyncGenerator<number, unknown, unknown> {
        if (entry.out === "no") elseEvaluated = true;
        return entry.out;
      },
    };
    expect(await fold(expr, customInterp)).toBe("yes");
    expect(elseEvaluated).toBe(false);
  });
});

describe("core/discard", () => {
  it("evaluates side effect and returns result", async () => {
    const side = node<string>("core/literal", [], "side effect");
    const result = node<number>("core/literal", [], 42);
    const discard = node<number>("core/discard", [side, result]);
    expect(await fold(app(discard), interp)).toBe(42);
  });

  it("chains multiple discards for sequencing", async () => {
    const a = node<string>("core/literal", [], "first");
    const b = node<string>("core/literal", [], "second");
    const c = node<number>("core/literal", [], 99);
    const d1 = node<string>("core/discard", [a, b]);
    const d2 = node<number>("core/discard", [d1, c]);
    expect(await fold(app(d2), interp)).toBe(99);
  });
});

describe("content-addressed sharing", () => {
  it("identical literals share the same ID", () => {
    const a = node<number>("core/literal", [], 42);
    const b = node<number>("core/literal", [], 42);
    expect(a.__id).toBe(b.__id);
  });

  it("different literals have different IDs", () => {
    const a = node<number>("core/literal", [], 42);
    const b = node<number>("core/literal", [], 43);
    expect(a.__id).not.toBe(b.__id);
  });

  it("shared subtrees appear once in adjacency map", () => {
    const shared = node<number>("core/literal", [], 5);
    const sum = node<number>("num/add", [shared, shared]);
    const expr = app(sum);
    // Should have 2 entries: the literal and the add
    expect(Object.keys(expr.__adj).length).toBe(2);
  });
});

describe("memoization", () => {
  it("shared nodes evaluate exactly once", async () => {
    let evalCount = 0;
    const shared = node<number>("core/literal", [], 7);
    const sum = node<number>("num/add", [shared, shared]);
    const expr = app(sum);

    const customInterp = {
      "core/literal": async function* (
        entry: { out: unknown },
      ): AsyncGenerator<number, unknown, unknown> {
        evalCount++;
        return entry.out;
      },
      "num/add": async function* (): AsyncGenerator<number, number, number> {
        const a = yield 0;
        const b = yield 1;
        return a + b;
      },
    };
    const result = await fold(expr, customInterp);
    expect(result).toBe(14);
    expect(evalCount).toBe(1); // shared literal evaluated once
  });
});
