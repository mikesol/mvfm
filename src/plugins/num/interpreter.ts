import type { ASTNode, InterpreterFragment } from "../../core";

export const numInterpreter: InterpreterFragment = {
  pluginName: "num",
  canHandle: (node) => node.kind.startsWith("num/"),
  visit(node: ASTNode, recurse: (node: ASTNode) => unknown): unknown {
    switch (node.kind) {
      case "num/add":
        return (
          (recurse(node.left as ASTNode) as number) + (recurse(node.right as ASTNode) as number)
        );
      case "num/sub":
        return (
          (recurse(node.left as ASTNode) as number) - (recurse(node.right as ASTNode) as number)
        );
      case "num/mul":
        return (
          (recurse(node.left as ASTNode) as number) * (recurse(node.right as ASTNode) as number)
        );
      case "num/div":
        return (
          (recurse(node.left as ASTNode) as number) / (recurse(node.right as ASTNode) as number)
        );
      case "num/mod":
        return (
          (recurse(node.left as ASTNode) as number) % (recurse(node.right as ASTNode) as number)
        );
      case "num/compare": {
        const l = recurse(node.left as ASTNode) as number;
        const r = recurse(node.right as ASTNode) as number;
        return l < r ? -1 : l === r ? 0 : 1;
      }
      case "num/neg":
        return -(recurse(node.operand as ASTNode) as number);
      case "num/abs":
        return Math.abs(recurse(node.operand as ASTNode) as number);
      case "num/floor":
        return Math.floor(recurse(node.operand as ASTNode) as number);
      case "num/ceil":
        return Math.ceil(recurse(node.operand as ASTNode) as number);
      case "num/round":
        return Math.round(recurse(node.operand as ASTNode) as number);
      case "num/min":
        return Math.min(...(node.values as ASTNode[]).map((v) => recurse(v) as number));
      case "num/max":
        return Math.max(...(node.values as ASTNode[]).map((v) => recurse(v) as number));
      case "num/eq":
        return recurse(node.left as ASTNode) === recurse(node.right as ASTNode);
      case "num/zero":
        return 0;
      case "num/one":
        return 1;
      case "num/show":
        return String(recurse(node.operand as ASTNode));
      case "num/top":
        return Infinity;
      case "num/bottom":
        return -Infinity;
      default:
        throw new Error(`Num interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
