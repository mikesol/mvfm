import { describe, expect, it } from "vitest";
import type { ASTNode, InterpreterFragment, StepEffect } from "../../src/core";
import { composeInterpreters } from "../../src/core";

describe("async engine: composeInterpreters", () => {
  it("returns a function that returns a Promise", async () => {
    const fragment: InterpreterFragment = {
      pluginName: "test",
      canHandle: (node) => node.kind === "test/literal",
      // biome-ignore lint/correctness/useYield: leaf node returns directly without yielding
      *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
        return node.value;
      },
    };
    const interp = composeInterpreters([fragment]);
    const result = interp({ kind: "test/literal", value: 42 });
    // Must be a Promise
    expect(result).toBeInstanceOf(Promise);
    expect(await result).toBe(42);
  });

  it("recurse passes Promises between fragments", async () => {
    const inner: InterpreterFragment = {
      pluginName: "inner",
      canHandle: (node) => node.kind === "inner/value",
      // biome-ignore lint/correctness/useYield: leaf node returns directly without yielding
      *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
        return node.value;
      },
    };
    const outer: InterpreterFragment = {
      pluginName: "outer",
      canHandle: (node) => node.kind === "outer/double",
      *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
        const val = (yield { type: "recurse", child: node.inner as ASTNode }) as number;
        return val * 2;
      },
    };
    const interp = composeInterpreters([outer, inner]);
    const result = await interp({
      kind: "outer/double",
      inner: { kind: "inner/value", value: 21 },
    });
    expect(result).toBe(42);
  });
});
