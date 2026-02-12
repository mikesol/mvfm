import type { ASTNode, InterpreterFragment } from "../../core";

export const booleanInterpreter: InterpreterFragment = {
  pluginName: "boolean",
  canHandle: (node) => node.kind.startsWith("boolean/"),
  visit(node: ASTNode, recurse: (node: ASTNode) => unknown): unknown {
    switch (node.kind) {
      case "boolean/and":
        return (
          (recurse(node.left as ASTNode) as boolean) && (recurse(node.right as ASTNode) as boolean)
        );
      case "boolean/or":
        return (
          (recurse(node.left as ASTNode) as boolean) || (recurse(node.right as ASTNode) as boolean)
        );
      case "boolean/not":
        return !(recurse(node.operand as ASTNode) as boolean);
      case "boolean/eq":
        return recurse(node.left as ASTNode) === recurse(node.right as ASTNode);
      case "boolean/ff":
        return false;
      case "boolean/tt":
        return true;
      case "boolean/implies":
        return (
          !(recurse(node.left as ASTNode) as boolean) || (recurse(node.right as ASTNode) as boolean)
        );
      case "boolean/show":
        return String(recurse(node.operand as ASTNode));
      case "boolean/top":
        return true;
      case "boolean/bottom":
        return false;
      default:
        throw new Error(`Boolean interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
