import type { ASTNode, InterpreterFragment } from "../../core";

export const booleanInterpreter: InterpreterFragment = {
  pluginName: "boolean",
  canHandle: (node) => node.kind.startsWith("boolean/"),
  async visit(node: ASTNode, recurse: (node: ASTNode) => Promise<unknown>): Promise<unknown> {
    switch (node.kind) {
      case "boolean/and": {
        const left = (await recurse(node.left as ASTNode)) as boolean;
        return left ? ((await recurse(node.right as ASTNode)) as boolean) : false;
      }
      case "boolean/or": {
        const left = (await recurse(node.left as ASTNode)) as boolean;
        return left ? true : ((await recurse(node.right as ASTNode)) as boolean);
      }
      case "boolean/not":
        return !((await recurse(node.operand as ASTNode)) as boolean);
      case "boolean/eq":
        return (await recurse(node.left as ASTNode)) === (await recurse(node.right as ASTNode));
      case "boolean/ff":
        return false;
      case "boolean/tt":
        return true;
      case "boolean/implies": {
        const left = (await recurse(node.left as ASTNode)) as boolean;
        return !left ? true : ((await recurse(node.right as ASTNode)) as boolean);
      }
      case "boolean/show":
        return String(await recurse(node.operand as ASTNode));
      case "boolean/top":
        return true;
      case "boolean/bottom":
        return false;
      default:
        throw new Error(`Boolean interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
