import type { ASTNode, InterpreterFragment, StepEffect } from "../../core";

/**
 * Walk an AST subtree and inject a value into matching lambda_param nodes.
 * This is how the error interpreter passes the caught error to the catch body.
 */
export function injectLambdaParam(node: any, param: { name: string }, value: unknown): void {
  if (node === null || node === undefined || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) injectLambdaParam(item, param, value);
    return;
  }
  if (node.kind === "core/lambda_param" && node.name === param.name) {
    node.__value = value;
  }
  for (const v of Object.values(node)) {
    if (typeof v === "object" && v !== null) {
      injectLambdaParam(v, param, value);
    }
  }
}

/** Interpreter fragment for `error/` node kinds. */
export const errorInterpreter: InterpreterFragment = {
  pluginName: "error",
  canHandle: (node) => node.kind.startsWith("error/"),
  *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
    switch (node.kind) {
      case "error/try": {
        try {
          const value = yield { type: "recurse", child: node.expr as ASTNode };
          return value;
        } catch (e) {
          if (node.catch) {
            const catchInfo = node.catch as { param: ASTNode; body: ASTNode };
            injectLambdaParam(catchInfo.body, catchInfo.param as any, e);
            return yield { type: "recurse", child: catchInfo.body };
          }
          if (node.match) {
            const matchInfo = node.match as {
              param: ASTNode;
              branches: Record<string, ASTNode>;
            };
            const errObj = e as any;
            const key = typeof errObj === "string" ? errObj : (errObj?.code ?? errObj?.type ?? "_");
            const branch = matchInfo.branches[key] ?? matchInfo.branches._ ?? null;
            if (!branch) throw e;
            injectLambdaParam(branch, matchInfo.param as any, e);
            return yield { type: "recurse", child: branch };
          }
          throw e;
        } finally {
          if (node.finally) {
            yield { type: "recurse", child: node.finally as ASTNode };
          }
        }
      }

      case "error/fail": {
        const error = yield { type: "recurse", child: node.error as ASTNode };
        throw error;
      }

      case "error/attempt": {
        try {
          const ok = yield { type: "recurse", child: node.expr as ASTNode };
          return { ok, err: null };
        } catch (e) {
          return { ok: null, err: e };
        }
      }

      case "error/guard": {
        const condition = yield { type: "recurse", child: node.condition as ASTNode };
        if (!condition) {
          throw yield { type: "recurse", child: node.error as ASTNode };
        }
        return undefined;
      }

      case "error/settle": {
        const exprs = node.exprs as ASTNode[];
        const fulfilled: unknown[] = [];
        const rejected: unknown[] = [];
        for (const expr of exprs) {
          try {
            const value = yield { type: "recurse", child: expr };
            fulfilled.push(value);
          } catch (e) {
            rejected.push(e);
          }
        }
        return { fulfilled, rejected };
      }

      default:
        throw new Error(`Error interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
