import type { Expr, PluginContext } from "../../core";
import { definePlugin } from "../../core";

/**
 * Mutable state operations for local variables within a program.
 */
export interface StMethods {
  /**
   * Declare a mutable local variable.
   *
   * @param initial - The initial value.
   * @returns An object with `get`, `set`, and `push` methods.
   */
  let<T>(initial: Expr<T> | T): {
    get: () => Expr<T>;
    set: (value: Expr<T> | T) => void;
    push: (value: Expr<T>) => void;
  };
}

/**
 * Mutable state plugin. Namespace: `st/`.
 *
 * Provides `let` for declaring local mutable variables with get/set/push access.
 */
export const st = definePlugin({
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
});
