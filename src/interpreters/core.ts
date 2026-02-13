import type { ASTNode, InterpreterFragment } from "../core";

/** Interpreter fragment for core node kinds (literal, input, prop_access, cond, do, program, tuple, record). */
export const coreInterpreter: InterpreterFragment = {
  pluginName: "core",
  canHandle: (node) => node.kind.startsWith("core/"),
  async visit(node: ASTNode, recurse: (node: ASTNode) => Promise<unknown>): Promise<unknown> {
    switch (node.kind) {
      case "core/literal":
        return node.value;

      case "core/input":
        return (node as any).__inputData;

      case "core/prop_access": {
        const obj = (await recurse(node.object as ASTNode)) as Record<string, unknown>;
        return obj[node.property as string];
      }

      case "core/record": {
        const fields = node.fields as Record<string, ASTNode>;
        const entries = Object.entries(fields);
        const values = await Promise.all(entries.map(([, fieldNode]) => recurse(fieldNode)));
        const result: Record<string, unknown> = {};
        for (let i = 0; i < entries.length; i++) {
          result[entries[i][0]] = values[i];
        }
        return result;
      }

      case "core/cond": {
        const predicate = await recurse(node.predicate as ASTNode);
        return predicate
          ? await recurse(node.then as ASTNode)
          : await recurse(node.else as ASTNode);
      }

      case "core/do": {
        const steps = node.steps as ASTNode[];
        for (const step of steps) {
          await recurse(step);
        }
        return await recurse(node.result as ASTNode);
      }

      case "core/program":
        return await recurse(node.result as ASTNode);

      case "core/tuple": {
        const elements = node.elements as ASTNode[];
        return await Promise.all(elements.map((el) => recurse(el)));
      }

      case "core/lambda_param":
        return (node as any).__value;

      default:
        throw new Error(`Core interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
