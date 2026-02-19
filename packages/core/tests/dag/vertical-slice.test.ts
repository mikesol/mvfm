/**
 * Vertical slice: end-to-end DAG model test.
 *
 * Proves: mvfm(numDagPlugin) → user closure → CExpr → app() → NExpr → fold() → result
 */

import { describe, it, expect } from "vitest";
import { node, mvfm } from "../../src/dag/builder";
import { app } from "../../src/dag/03-normalize";
import { fold, defaults } from "../../src/dag/fold";
import { createCoreDagInterpreter } from "../../src/dag/core-interpreter";
import { createNumDagInterpreter } from "../../src/plugins/num/interpreter";
import { numDagPlugin } from "../../src/plugins/num/index";

describe("vertical slice — end-to-end DAG model", () => {
  it("builds and evaluates (3 + 4) * 5 = 35 via raw node()", async () => {
    // Build CExprs using generic node builder
    const lit3 = node<number>("core/literal", [], 3);
    const lit4 = node<number>("core/literal", [], 4);
    const lit5 = node<number>("core/literal", [], 5);
    const sum = node<number>("num/add", [lit3, lit4]);
    const product = node<number>("num/mul", [sum, lit5]);

    // Normalize
    const expr = app(product);

    // Fold with combined interpreter
    const interp = {
      ...createCoreDagInterpreter(),
      ...createNumDagInterpreter(),
    };
    const result = await fold(expr, interp);
    expect(result).toBe(35);
  });

  it("content-addressed: equal subtrees share IDs", () => {
    const a = node<number>("core/literal", [], 3);
    const b = node<number>("core/literal", [], 3);

    // Same content → same ID
    expect(a.__id).toBe(b.__id);

    // After normalization, shared node appears once
    const sum = node<number>("num/add", [a, b]);
    const expr = app(sum);
    const adj = expr.__adj;

    // Should have 2 entries: one literal "a", one add "b"
    expect(Object.keys(adj).length).toBe(2);

    // The add node should reference the same child twice
    const rootEntry = adj[expr.__id];
    expect(rootEntry.children[0]).toBe(rootEntry.children[1]);
  });

  it("memoization: shared nodes evaluate once", async () => {
    let evalCount = 0;

    const lit3 = node<number>("core/literal", [], 3);
    const sum = node<number>("num/add", [lit3, lit3]);
    const expr = app(sum);

    const interp = {
      ...createNumDagInterpreter(),
      "core/literal": async function* (
        entry: { out: unknown },
      ): AsyncGenerator<number, unknown, unknown> {
        evalCount++;
        return entry.out;
      },
    };

    const result = await fold(expr, interp);
    expect(result).toBe(6);
    // The literal node "a" is shared — should be evaluated exactly once
    expect(evalCount).toBe(1);
  });

  it("core/literal evaluates to its out value", async () => {
    const lit = node<number>("core/literal", [], 42);
    const expr = app(lit);
    const interp = createCoreDagInterpreter();
    const result = await fold(expr, interp);
    expect(result).toBe(42);
  });

  it("core/cond evaluates correct branch", async () => {
    const trueLit = node<boolean>("core/literal", [], true);
    const yes = node<number>("core/literal", [], 1);
    const no = node<number>("core/literal", [], 0);
    const cond = node<number>("core/cond", [trueLit, yes, no]);
    const expr = app(cond);
    const interp = createCoreDagInterpreter();
    const result = await fold(expr, interp);
    expect(result).toBe(1);
  });

  it("mvfm() produces working Program from user closure", async () => {
    const prog = mvfm(numDagPlugin, ($: any) => {
      const three = $.num.literal(3);
      const four = $.num.literal(4);
      const five = $.num.literal(5);
      const sum = $.num.add(three, four);
      return $.num.mul(sum, five);
    });

    const result = await prog.eval();
    expect(result).toBe(35);
  });

  it("mvfm() with subtraction and negation", async () => {
    const prog = mvfm(numDagPlugin, ($: any) => {
      const ten = $.num.literal(10);
      const three = $.num.literal(3);
      return $.num.sub(ten, three);
    });

    const result = await prog.eval();
    expect(result).toBe(7);
  });

  it("mvfm() with nested expressions", async () => {
    // ((2 + 3) * (4 + 5)) = 5 * 9 = 45
    const prog = mvfm(numDagPlugin, ($: any) => {
      const a = $.num.add($.num.literal(2), $.num.literal(3));
      const b = $.num.add($.num.literal(4), $.num.literal(5));
      return $.num.mul(a, b);
    });

    const result = await prog.eval();
    expect(result).toBe(45);
  });

  it("mvfm() with DAG sharing in user closure", async () => {
    // shared = 3 + 4; result = shared * shared = 49
    const prog = mvfm(numDagPlugin, ($: any) => {
      const shared = $.num.add($.num.literal(3), $.num.literal(4));
      return $.num.mul(shared, shared);
    });

    const result = await prog.eval();
    expect(result).toBe(49);

    // Verify DAG sharing: shared subtree should appear once
    const adj = prog.expr.__adj;
    const entries = Object.values(adj);
    const addNodes = entries.filter((e) => e.kind === "num/add");
    expect(addNodes.length).toBe(1);
  });

  it("defaults() composes core + num interpreters", async () => {
    const lit = node<number>("core/literal", [], 7);
    const expr = app(lit);

    const corePlugin = {
      name: "core",
      nodeKinds: ["core/literal"] as readonly string[],
      defaultInterpreter: createCoreDagInterpreter,
    };
    const interp = defaults([corePlugin, numDagPlugin]);
    const result = await fold(expr, interp);
    expect(result).toBe(7);
  });

  it("Program.eval() uses defaults() automatically", async () => {
    const prog = mvfm(numDagPlugin, ($: any) => {
      return $.num.add($.num.literal(10), $.num.literal(20));
    });

    // eval() should compose interpreters internally
    const result = await prog.eval();
    expect(result).toBe(30);
  });
});
