import type { Expr, PluginContext, PluginDefinition } from "../core";

export interface StMethods {
  let<T>(initial: Expr<T> | T): {
    get: () => Expr<T>;
    set: (value: Expr<T> | T) => void;
    push: (value: Expr<T>) => void;
  };
}

export const st: PluginDefinition<StMethods> = {
  name: "st",
  nodeKinds: ["st/let", "st/get", "st/set", "st/push"],
  build(ctx: PluginContext): StMethods {
    let refCounter = 0;

    return {
      let<T>(initial: Expr<T> | T) {
        const ref = `st_${refCounter++}`;
        const initNode = ctx.lift(initial).__node;
        ctx.emit({ kind: "st/let", ref, initial: initNode });

        return {
          get: () => ctx.expr<T>({ kind: "st/get", ref }),
          set: (value: Expr<T> | T) =>
            ctx.emit({
              kind: "st/set",
              ref,
              value: ctx.lift(value).__node,
            }),
          push: (value: Expr<T>) =>
            ctx.emit({
              kind: "st/push",
              ref,
              value: value.__node,
            }),
        };
      },
    };
  },
};
