import type { ASTNode, InterpreterFragment, StepEffect } from "../core";

/** Interpreter fragment for core node kinds (literal, input, prop_access, cond, do, program, tuple, record). */
export const coreInterpreter: InterpreterFragment = {
  pluginName: "core",
  canHandle: (node) => node.kind.startsWith("core/"),
  *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
    switch (node.kind) {
      case "core/literal":
        return node.value;

      case "core/input":
        return (node as any).__inputData;

      case "core/prop_access": {
        const obj = (yield { type: "recurse", child: node.object as ASTNode }) as Record<
          string,
          unknown
        >;
        return obj[node.property as string];
      }

      case "core/record": {
        const fields = node.fields as Record<string, ASTNode>;
        const result: Record<string, unknown> = {};
        for (const [key, fieldNode] of Object.entries(fields)) {
          result[key] = yield { type: "recurse", child: fieldNode };
        }
        return result;
      }

      case "core/cond": {
        const predicate = yield { type: "recurse", child: node.predicate as ASTNode };
        if (predicate) {
          return yield { type: "recurse", child: node.then as ASTNode };
        }
        return yield { type: "recurse", child: node.else as ASTNode };
      }

      case "core/do": {
        const steps = node.steps as ASTNode[];
        for (const step of steps) {
          yield { type: "recurse", child: step };
        }
        return yield { type: "recurse", child: node.result as ASTNode };
      }

      case "core/program":
        return yield { type: "recurse", child: node.result as ASTNode };

      case "core/tuple": {
        const elements = node.elements as ASTNode[];
        const results: unknown[] = [];
        for (const el of elements) {
          results.push(yield { type: "recurse", child: el });
        }
        return results;
      }

      case "core/lambda_param":
        return (node as any).__value;

      default:
        throw new Error(`Core interpreter: unknown node kind "${node.kind}"`);
    }
  },
  isVolatile: (node) => node.kind === "core/lambda_param",
};
