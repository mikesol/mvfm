import type { ASTNode, InterpreterFragment } from "../../core";

/** Interpreter fragment for `eq/` node kinds. */
export const eqInterpreter: InterpreterFragment = {
  pluginName: "eq",
  canHandle: (node) => node.kind.startsWith("eq/"),
  async visit(node: ASTNode, recurse: (node: ASTNode) => Promise<unknown>): Promise<unknown> {
    switch (node.kind) {
      case "eq/neq":
        return !(await recurse(node.inner as ASTNode));
      default:
        throw new Error(`Eq interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
