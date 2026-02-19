import { describe, it, expect } from "vitest";
import { makeNExpr } from "../../src/dag/00-expr";
import { fold, VOLATILE_KINDS } from "../../src/dag/fold";
import type { RuntimeEntry, Interpreter } from "../../src/dag/fold";

describe("fold — volatile/taint", () => {
  it("volatile nodes always re-evaluate", async () => {
    let getCount = 0;
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "st/get", children: [], out: "x" },
      b: { kind: "num/add", children: ["a", "a"], out: undefined },
    };
    const interp: Interpreter = {
      "st/get": async function* () {
        getCount++;
        return 10;
      },
      "num/add": async function* () {
        const l = (yield 0) as number;
        const r = (yield 1) as number;
        return l + r;
      },
    };
    const expr = makeNExpr("b", adj, "c");
    const result = await fold(expr, interp);
    expect(result).toBe(20);
    expect(getCount).toBe(2); // volatile → runs twice despite sharing
  });

  it("tainted parents re-evaluate", async () => {
    let addCount = 0;
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "st/get", children: [], out: "x" },
      b: { kind: "num/literal", children: [], out: 5 },
      c: { kind: "num/add", children: ["a", "b"], out: undefined },
      d: { kind: "num/mul", children: ["c", "c"], out: undefined },
    };
    const interp: Interpreter = {
      "st/get": async function* () {
        return 3;
      },
      "num/literal": async function* (entry) {
        return entry.out;
      },
      "num/add": async function* () {
        addCount++;
        return ((yield 0) as number) + ((yield 1) as number);
      },
      "num/mul": async function* () {
        return ((yield 0) as number) * ((yield 1) as number);
      },
    };
    const expr = makeNExpr("d", adj, "e");
    const result = await fold(expr, interp);
    expect(result).toBe(64); // (3+5)*(3+5) = 64
    // "c" appears twice as child of "d", and is tainted → should eval twice
    expect(addCount).toBe(2);
  });

  it("non-volatile nodes are still memoized", async () => {
    let litCount = 0;
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 5 },
      b: { kind: "num/add", children: ["a", "a"], out: undefined },
    };
    const interp: Interpreter = {
      "num/literal": async function* (entry) {
        litCount++;
        return entry.out;
      },
      "num/add": async function* () {
        return ((yield 0) as number) + ((yield 1) as number);
      },
    };
    const expr = makeNExpr("b", adj, "c");
    const result = await fold(expr, interp);
    expect(result).toBe(10);
    expect(litCount).toBe(1); // shared, not volatile → still memoized
  });

  it("custom volatile kinds via options", async () => {
    let evalCount = 0;
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "custom/sensor", children: [], out: undefined },
      b: { kind: "num/add", children: ["a", "a"], out: undefined },
    };
    const interp: Interpreter = {
      "custom/sensor": async function* () {
        evalCount++;
        return 42;
      },
      "num/add": async function* () {
        return ((yield 0) as number) + ((yield 1) as number);
      },
    };
    const expr = makeNExpr("b", adj, "c");
    const customVolatile = new Set([...VOLATILE_KINDS, "custom/sensor"]);
    await fold(expr, interp, { volatileKinds: customVolatile });
    expect(evalCount).toBe(2);
  });

  it("taint propagates transitively through multiple levels", async () => {
    // a (volatile) → b (tainted) → c (tainted) → d uses c twice
    let bCount = 0;
    let cCount = 0;
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "st/get", children: [], out: "x" },
      b: { kind: "num/identity", children: ["a"], out: undefined },
      c: { kind: "num/identity", children: ["b"], out: undefined },
      d: { kind: "num/add", children: ["c", "c"], out: undefined },
    };
    const interp: Interpreter = {
      "st/get": async function* () {
        return 7;
      },
      "num/identity": async function* (entry) {
        if (entry.children[0] === "a") bCount++;
        else cCount++;
        return (yield 0) as number;
      },
      "num/add": async function* () {
        return ((yield 0) as number) + ((yield 1) as number);
      },
    };
    const expr = makeNExpr("d", adj, "e");
    const result = await fold(expr, interp);
    expect(result).toBe(14);
    // b and c are tainted transitively, so each evaluates twice
    expect(bCount).toBe(2);
    expect(cCount).toBe(2);
  });
});
