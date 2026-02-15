import type { ASTNode, InterpreterFragment, StepEffect } from "../../core";
import { injectLambdaParam } from "../../core";

/** Interpreter fragment for `fiber/` node kinds. */
export const fiberInterpreter: InterpreterFragment = {
  pluginName: "fiber",
  canHandle: (node) => node.kind.startsWith("fiber/"),
  *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
    switch (node.kind) {
      case "fiber/par_map": {
        const collection = (yield {
          type: "recurse",
          child: node.collection as ASTNode,
        }) as unknown[];
        const concurrency = node.concurrency as number;
        const param = node.param as ASTNode;
        const body = node.body as ASTNode;

        const results: unknown[] = [];
        // Process items sequentially within the generator.
        // For parallel execution, use the fiberHandler with runAST.
        for (let i = 0; i < collection.length; i += concurrency) {
          const batch = collection.slice(i, i + concurrency);
          for (const item of batch) {
            const bodyClone = structuredClone(body);
            injectLambdaParam(bodyClone, (param as any).name, item);
            results.push(yield { type: "recurse", child: bodyClone });
          }
        }
        return results;
      }

      case "fiber/race": {
        const branches = node.branches as ASTNode[];
        // In the generator model, evaluate sequentially and return the first result.
        // For true Promise.race semantics, use the fiberHandler with runAST.
        if (branches.length === 0) throw new Error("fiber/race: no branches");
        return yield { type: "recurse", child: branches[0] };
      }

      case "fiber/timeout": {
        // In the generator model, evaluate the expression directly.
        // For true timeout semantics, use the fiberHandler with runAST.
        return yield { type: "recurse", child: node.expr as ASTNode };
      }

      case "fiber/retry": {
        const attempts = node.attempts as number;
        const _delay = (node.delay as number) ?? 0;
        let lastError: unknown;
        for (let i = 0; i < attempts; i++) {
          try {
            // Use structuredClone to bypass cache for each attempt
            const exprClone = structuredClone(node.expr as ASTNode);
            return yield { type: "recurse", child: exprClone };
          } catch (e) {
            lastError = e;
            // delay is not implementable in a sync generator; the fiberHandler
            // handles delays for runAST-based evaluation
          }
        }
        throw lastError;
      }

      default:
        throw new Error(`Fiber interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
