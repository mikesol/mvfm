import type { ASTNode, InterpreterFragment } from "../core";

export const coreInterpreter: InterpreterFragment = {
  pluginName: "core",
  canHandle: (node) => node.kind.startsWith("core/"),
  visit(node: ASTNode, recurse: (node: ASTNode) => unknown): unknown {
    switch (node.kind) {
      case "core/literal":
        return node.value;

      case "core/input":
        return (node as any).__inputData;

      case "core/prop_access": {
        const obj = recurse(node.object as ASTNode) as Record<string, unknown>;
        return obj[node.property as string];
      }

      case "core/record": {
        const fields = node.fields as Record<string, ASTNode>;
        const result: Record<string, unknown> = {};
        for (const [key, fieldNode] of Object.entries(fields)) {
          result[key] = recurse(fieldNode);
        }
        return result;
      }

      case "core/cond": {
        const predicate = recurse(node.predicate as ASTNode);
        return predicate ? recurse(node.then as ASTNode) : recurse(node.else as ASTNode);
      }

      case "core/do": {
        const steps = node.steps as ASTNode[];
        for (const step of steps) {
          recurse(step);
        }
        return recurse(node.result as ASTNode);
      }

      case "core/program":
        return recurse(node.result as ASTNode);

      case "core/tuple": {
        const elements = node.elements as ASTNode[];
        return elements.map((el) => recurse(el));
      }

      default:
        throw new Error(`Core interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
