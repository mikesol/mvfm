import { describe, expect, it } from "vitest";
import type { ASTNode, InterpreterFragment } from "../../src/core";
import { composeInterpreters } from "../../src/core";

describe("async engine: composeInterpreters", () => {
  it("returns a function that returns a Promise", async () => {
    const fragment: InterpreterFragment = {
      pluginName: "test",
      canHandle: (node) => node.kind === "test/literal",
      async visit(node: ASTNode, _recurse: (n: ASTNode) => Promise<unknown>) {
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
      async visit(node: ASTNode, _recurse: (n: ASTNode) => Promise<unknown>) {
        return node.value;
      },
    };
    const outer: InterpreterFragment = {
      pluginName: "outer",
      canHandle: (node) => node.kind === "outer/double",
      async visit(node: ASTNode, recurse: (n: ASTNode) => Promise<unknown>) {
        const val = (await recurse(node.inner as ASTNode)) as number;
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
