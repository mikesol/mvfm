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

export const errorInterpreter: InterpreterFragment = {
  pluginName: "error",
  canHandle: (node) => node.kind.startsWith("error/"),
  visit(node: ASTNode, recurse: (node: ASTNode) => unknown): unknown {
    switch (node.kind) {
      case "error/try": {
        const tryExpr = async () => {
          try {
            return await Promise.resolve(recurse(node.expr as ASTNode));
          } catch (e) {
            if (node.catch) {
              const catchInfo = node.catch as { param: ASTNode; body: ASTNode };
              injectLambdaParam(catchInfo.body, catchInfo.param as any, e);
              return await Promise.resolve(recurse(catchInfo.body));
            }
            if (node.match) {
              const matchInfo = node.match as {
                param: ASTNode;
                branches: Record<string, ASTNode>;
              };
              const errObj = e as any;
              const key =
                typeof errObj === "string" ? errObj : (errObj?.code ?? errObj?.type ?? "_");
              const branch = matchInfo.branches[key] ?? matchInfo.branches._ ?? null;
              if (!branch) throw e;
              injectLambdaParam(branch, matchInfo.param as any, e);
              return await Promise.resolve(recurse(branch));
            }
            throw e;
          } finally {
            if (node.finally) {
              await Promise.resolve(recurse(node.finally as ASTNode));
            }
          }
        };
        return tryExpr();
      }

      case "error/fail": {
        const failExpr = async () => {
          const error = await Promise.resolve(recurse(node.error as ASTNode));
          throw error;
        };
        return failExpr();
      }

      case "error/attempt": {
        const attemptExpr = async () => {
          try {
            const ok = await Promise.resolve(recurse(node.expr as ASTNode));
            return { ok, err: null };
          } catch (e) {
            return { ok: null, err: e };
          }
        };
        return attemptExpr();
      }

      case "error/guard": {
        const guardExpr = async () => {
          const condition = await Promise.resolve(recurse(node.condition as ASTNode));
          if (!condition) {
            throw await Promise.resolve(recurse(node.error as ASTNode));
          }
        };
        return guardExpr();
      }

      case "error/settle": {
        const settleExpr = async () => {
          const exprs = node.exprs as ASTNode[];
          const results = await Promise.allSettled(exprs.map((e) => Promise.resolve(recurse(e))));
          const fulfilled: unknown[] = [];
          const rejected: unknown[] = [];
          for (const r of results) {
            if (r.status === "fulfilled") fulfilled.push(r.value);
            else rejected.push(r.reason);
          }
          return { fulfilled, rejected };
        };
        return settleExpr();
      }

      default:
        throw new Error(`Error interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
