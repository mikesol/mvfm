import type { ASTNode, InterpreterFragment, StepEffect } from "../../core";

/** Interpreter fragment for `ord/` node kinds. */
export const ordInterpreter: InterpreterFragment = {
  pluginName: "ord",
  canHandle: (node) => node.kind.startsWith("ord/"),
  *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
    const cmp = (yield { type: "recurse", child: node.operand as ASTNode }) as number;
    switch (node.kind) {
      case "ord/gt":
        return cmp > 0;
      case "ord/gte":
        return cmp >= 0;
      case "ord/lt":
        return cmp < 0;
      case "ord/lte":
        return cmp <= 0;
      default:
        throw new Error(`Ord interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
