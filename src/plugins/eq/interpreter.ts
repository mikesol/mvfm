import type { ASTNode, InterpreterFragment, StepEffect } from "../../core";

/** Interpreter fragment for `eq/` node kinds. */
export const eqInterpreter: InterpreterFragment = {
  pluginName: "eq",
  canHandle: (node) => node.kind.startsWith("eq/"),
  *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
    switch (node.kind) {
      case "eq/neq":
        return !(yield { type: "recurse", child: node.inner as ASTNode });
      default:
        throw new Error(`Eq interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
