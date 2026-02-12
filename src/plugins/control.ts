import type { ASTNode, Expr, PluginContext, PluginDefinition } from "../core";

export interface ControlMethods {
  each<T>(collection: Expr<T[]>, body: (item: Expr<T>) => void): void;
  while(condition: Expr<boolean>): {
    body: (...statements: unknown[]) => void;
  };
}

export const control: PluginDefinition<ControlMethods> = {
  name: "control",
  nodeKinds: ["control/each", "control/while"],
  build(ctx: PluginContext): ControlMethods {
    return {
      each<T>(collection: Expr<T[]>, body: (item: Expr<T>) => void) {
        const paramNode: ASTNode = { kind: "core/lambda_param", name: "item" };
        const paramProxy = ctx.expr<T>(paramNode) as Expr<T>;
        const prevLen = ctx.statements.length;
        body(paramProxy);
        const bodyStatements = ctx.statements.splice(prevLen);
        ctx.emit({
          kind: "control/each",
          collection: collection.__node,
          param: paramNode,
          body: bodyStatements,
        });
      },

      while(condition: Expr<boolean>) {
        return {
          body: (...stmts: unknown[]) => {
            ctx.emit({
              kind: "control/while",
              condition: condition.__node,
              body: stmts.filter((s) => ctx.isExpr(s)).map((s) => (s as Expr<unknown>).__node),
            });
          },
        };
      },
    };
  },
};
