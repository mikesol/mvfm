import type { ASTNode, InterpreterFragment } from "../../core";

export const ordInterpreter: InterpreterFragment = {
  pluginName: "ord",
  canHandle: (node) => node.kind.startsWith("ord/"),
  async visit(node: ASTNode, recurse: (node: ASTNode) => Promise<unknown>): Promise<unknown> {
    const cmp = (await recurse(node.operand as ASTNode)) as number;
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
