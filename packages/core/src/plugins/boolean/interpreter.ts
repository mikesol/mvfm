import type { ASTNode, InterpreterFragment, StepEffect } from "../../core";

/** Interpreter fragment for `boolean/` node kinds. */
export const booleanInterpreter: InterpreterFragment = {
  pluginName: "boolean",
  canHandle: (node) => node.kind.startsWith("boolean/"),
  *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
    switch (node.kind) {
      case "boolean/and": {
        const left = (yield { type: "recurse", child: node.left as ASTNode }) as boolean;
        return left
          ? ((yield { type: "recurse", child: node.right as ASTNode }) as boolean)
          : false;
      }
      case "boolean/or": {
        const left = (yield { type: "recurse", child: node.left as ASTNode }) as boolean;
        return left ? true : ((yield { type: "recurse", child: node.right as ASTNode }) as boolean);
      }
      case "boolean/not":
        return !((yield { type: "recurse", child: node.operand as ASTNode }) as boolean);
      case "boolean/eq":
        return (
          (yield { type: "recurse", child: node.left as ASTNode }) ===
          (yield { type: "recurse", child: node.right as ASTNode })
        );
      case "boolean/ff":
        return false;
      case "boolean/tt":
        return true;
      case "boolean/implies": {
        const left = (yield { type: "recurse", child: node.left as ASTNode }) as boolean;
        return !left
          ? true
          : ((yield { type: "recurse", child: node.right as ASTNode }) as boolean);
      }
      case "boolean/show":
        return String(yield { type: "recurse", child: node.operand as ASTNode });
      case "boolean/top":
        return true;
      case "boolean/bottom":
        return false;
      default:
        throw new Error(`Boolean interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
