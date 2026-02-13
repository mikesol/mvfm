import type { ASTNode, InterpreterFragment } from "../../core";

/**
 * Walk an AST subtree and inject a value into matching lambda_param nodes.
 * This is how the error interpreter passes the caught error to the catch body.
 */
function injectLambdaParam(node: any, param: { name: string }, value: unknown): void {
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
  async visit(node: ASTNode, recurse: (node: ASTNode) => Promise<unknown>): Promise<unknown> {
    switch (node.kind) {
      case "error/try": {
        try {
          return await recurse(node.expr as ASTNode);
        } catch (e) {
          if (node.catch) {
            const catchInfo = node.catch as { param: ASTNode; body: ASTNode };
            injectLambdaParam(catchInfo.body, catchInfo.param as any, e);
            return await recurse(catchInfo.body);
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
            return await recurse(branch);
          }
          throw e;
        } finally {
          if (node.finally) {
            await recurse(node.finally as ASTNode);
          }
        }
      }

      case "error/fail": {
        const error = await recurse(node.error as ASTNode);
        throw error;
      }

      case "error/attempt": {
        try {
          const ok = await recurse(node.expr as ASTNode);
          return { ok, err: null };
        } catch (e) {
          return { ok: null, err: e };
        }
      }

      case "error/guard": {
        const condition = await recurse(node.condition as ASTNode);
        if (!condition) {
          throw await recurse(node.error as ASTNode);
        }
        return undefined;
      }

      case "error/settle": {
        const exprs = node.exprs as ASTNode[];
        const results = await Promise.allSettled(exprs.map((e) => recurse(e)));
        const fulfilled: unknown[] = [];
        const rejected: unknown[] = [];
        for (const r of results) {
          if (r.status === "fulfilled") fulfilled.push(r.value);
          else rejected.push(r.reason);
        }
        return { fulfilled, rejected };
      }

      default:
        throw new Error(`Error interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
