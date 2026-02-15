import type { ASTNode, InterpreterFragment, StepEffect } from "../../core";

/** Interpreter fragment for `num/` node kinds. */
export const numInterpreter: InterpreterFragment = {
  pluginName: "num",
  canHandle: (node) => node.kind.startsWith("num/"),
  *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
    switch (node.kind) {
      case "num/add":
        return (
          ((yield { type: "recurse", child: node.left as ASTNode }) as number) +
          ((yield { type: "recurse", child: node.right as ASTNode }) as number)
        );
      case "num/sub":
        return (
          ((yield { type: "recurse", child: node.left as ASTNode }) as number) -
          ((yield { type: "recurse", child: node.right as ASTNode }) as number)
        );
      case "num/mul":
        return (
          ((yield { type: "recurse", child: node.left as ASTNode }) as number) *
          ((yield { type: "recurse", child: node.right as ASTNode }) as number)
        );
      case "num/div":
        return (
          ((yield { type: "recurse", child: node.left as ASTNode }) as number) /
          ((yield { type: "recurse", child: node.right as ASTNode }) as number)
        );
      case "num/mod":
        return (
          ((yield { type: "recurse", child: node.left as ASTNode }) as number) %
          ((yield { type: "recurse", child: node.right as ASTNode }) as number)
        );
      case "num/compare": {
        const l = (yield { type: "recurse", child: node.left as ASTNode }) as number;
        const r = (yield { type: "recurse", child: node.right as ASTNode }) as number;
        return l < r ? -1 : l === r ? 0 : 1;
      }
      case "num/neg":
        return -((yield { type: "recurse", child: node.operand as ASTNode }) as number);
      case "num/abs":
        return Math.abs((yield { type: "recurse", child: node.operand as ASTNode }) as number);
      case "num/floor":
        return Math.floor((yield { type: "recurse", child: node.operand as ASTNode }) as number);
      case "num/ceil":
        return Math.ceil((yield { type: "recurse", child: node.operand as ASTNode }) as number);
      case "num/round":
        return Math.round((yield { type: "recurse", child: node.operand as ASTNode }) as number);
      case "num/min": {
        const values: number[] = [];
        for (const v of node.values as ASTNode[]) {
          values.push((yield { type: "recurse", child: v }) as number);
        }
        return Math.min(...values);
      }
      case "num/max": {
        const values: number[] = [];
        for (const v of node.values as ASTNode[]) {
          values.push((yield { type: "recurse", child: v }) as number);
        }
        return Math.max(...values);
      }
      case "num/eq":
        return (
          (yield { type: "recurse", child: node.left as ASTNode }) ===
          (yield { type: "recurse", child: node.right as ASTNode })
        );
      case "num/zero":
        return 0;
      case "num/one":
        return 1;
      case "num/show":
        return String(yield { type: "recurse", child: node.operand as ASTNode });
      case "num/top":
        return Infinity;
      case "num/bottom":
        return -Infinity;
      default:
        throw new Error(`Num interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
