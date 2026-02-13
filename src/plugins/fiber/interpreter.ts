import type { ASTNode, InterpreterFragment } from "../../core";

/**
 * Walk an AST subtree and inject a value into matching lambda_param nodes.
 * This is how the fiber interpreter passes collection items to the par_map body.
 */
function injectLambdaParam(node: any, name: string, value: unknown): void {
  if (node === null || node === undefined || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) injectLambdaParam(item, name, value);
    return;
  }
  if (node.kind === "core/lambda_param" && node.name === name) {
    node.__value = value;
  }
  for (const v of Object.values(node)) {
    if (typeof v === "object" && v !== null) {
      injectLambdaParam(v, name, value);
    }
  }
}

export const fiberInterpreter: InterpreterFragment = {
  pluginName: "fiber",
  canHandle: (node) => node.kind.startsWith("fiber/"),
  async visit(node: ASTNode, recurse: (node: ASTNode) => Promise<unknown>): Promise<unknown> {
    switch (node.kind) {
      case "fiber/par_map": {
        const collection = (await recurse(node.collection as ASTNode)) as unknown[];
        const concurrency = node.concurrency as number;
        const param = node.param as ASTNode;
        const body = node.body as ASTNode;

        const results: unknown[] = [];
        for (let i = 0; i < collection.length; i += concurrency) {
          const batch = collection.slice(i, i + concurrency);
          const batchResults = await Promise.all(
            batch.map((item) => {
              const bodyClone = structuredClone(body);
              injectLambdaParam(bodyClone, (param as any).name, item);
              return recurse(bodyClone);
            }),
          );
          results.push(...batchResults);
        }
        return results;
      }

      case "fiber/race": {
        const branches = node.branches as ASTNode[];
        return Promise.race(branches.map((b) => recurse(b)));
      }

      case "fiber/timeout": {
        const ms = (await recurse(node.ms as ASTNode)) as number;
        const fallback = () => recurse(node.fallback as ASTNode);
        const expr = recurse(node.expr as ASTNode);
        let timerId: ReturnType<typeof setTimeout>;
        const timer = new Promise<unknown>((resolve) => {
          timerId = setTimeout(async () => resolve(await fallback()), ms);
        });
        return Promise.race([expr, timer]).finally(() => clearTimeout(timerId!));
      }

      case "fiber/retry": {
        const attempts = node.attempts as number;
        const delay = (node.delay as number) ?? 0;
        let lastError: unknown;
        for (let i = 0; i < attempts; i++) {
          try {
            return await recurse(node.expr as ASTNode);
          } catch (e) {
            lastError = e;
            if (i < attempts - 1 && delay > 0) {
              await new Promise((r) => setTimeout(r, delay));
            }
          }
        }
        throw lastError;
      }

      default:
        throw new Error(`Fiber interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
