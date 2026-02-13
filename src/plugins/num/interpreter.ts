import type { ASTNode, InterpreterFragment } from "../../core";

export const numInterpreter: InterpreterFragment = {
  pluginName: "num",
  canHandle: (node) => node.kind.startsWith("num/"),
  async visit(node: ASTNode, recurse: (node: ASTNode) => Promise<unknown>): Promise<unknown> {
    switch (node.kind) {
      case "num/add":
        return (
          ((await recurse(node.left as ASTNode)) as number) +
          ((await recurse(node.right as ASTNode)) as number)
        );
      case "num/sub":
        return (
          ((await recurse(node.left as ASTNode)) as number) -
          ((await recurse(node.right as ASTNode)) as number)
        );
      case "num/mul":
        return (
          ((await recurse(node.left as ASTNode)) as number) *
          ((await recurse(node.right as ASTNode)) as number)
        );
      case "num/div":
        return (
          ((await recurse(node.left as ASTNode)) as number) /
          ((await recurse(node.right as ASTNode)) as number)
        );
      case "num/mod":
        return (
          ((await recurse(node.left as ASTNode)) as number) %
          ((await recurse(node.right as ASTNode)) as number)
        );
      case "num/compare": {
        const l = (await recurse(node.left as ASTNode)) as number;
        const r = (await recurse(node.right as ASTNode)) as number;
        return l < r ? -1 : l === r ? 0 : 1;
      }
      case "num/neg":
        return -((await recurse(node.operand as ASTNode)) as number);
      case "num/abs":
        return Math.abs((await recurse(node.operand as ASTNode)) as number);
      case "num/floor":
        return Math.floor((await recurse(node.operand as ASTNode)) as number);
      case "num/ceil":
        return Math.ceil((await recurse(node.operand as ASTNode)) as number);
      case "num/round":
        return Math.round((await recurse(node.operand as ASTNode)) as number);
      case "num/min": {
        const values = await Promise.all((node.values as ASTNode[]).map((v) => recurse(v)));
        return Math.min(...(values as number[]));
      }
      case "num/max": {
        const values = await Promise.all((node.values as ASTNode[]).map((v) => recurse(v)));
        return Math.max(...(values as number[]));
      }
      case "num/eq":
        return (await recurse(node.left as ASTNode)) === (await recurse(node.right as ASTNode));
      case "num/zero":
        return 0;
      case "num/one":
        return 1;
      case "num/show":
        return String(await recurse(node.operand as ASTNode));
      case "num/top":
        return Infinity;
      case "num/bottom":
        return -Infinity;
      default:
        throw new Error(`Num interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
