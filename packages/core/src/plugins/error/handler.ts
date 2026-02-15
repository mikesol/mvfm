import type { ASTNode, InterpreterFragment, StepEffect, StepHandler } from "../../core";
import { runAST } from "../../core";

/**
 * Effect handler for error/settle effects.
 *
 * Composes with an inner handler to handle the `error/settle` effect type.
 * All other effects are delegated to the inner handler unchanged.
 *
 * The `error/settle` effect runs `Promise.allSettled` over its expressions,
 * returning `{ fulfilled, rejected }` arrays.
 *
 * Note: `error/try`, `error/attempt`, `error/fail`, and `error/guard` are
 * implemented directly in the error interpreter generator using native
 * try/catch — they do not need handler support. Only `error/settle` requires
 * a handler because it needs parallel execution via `Promise.allSettled`.
 *
 * @param fragments - Generator interpreter fragments for evaluating sub-expressions.
 * @param innerHandler - The handler to delegate non-error effects to.
 * @returns A composed {@link StepHandler}.
 */
export function errorHandler(
  fragments: InterpreterFragment[],
  innerHandler: StepHandler<any>,
): StepHandler<any> {
  const composedHandler: StepHandler<any> = async (effect: StepEffect, context, state) => {
    if (effect.type === "error/settle") {
      const exprs = (effect as any).exprs as ASTNode[];
      const results = await Promise.allSettled(
        exprs.map((e) => runAST(e, fragments, composedHandler, undefined).then((r) => r.value)),
      );
      const fulfilled: unknown[] = [];
      const rejected: unknown[] = [];
      for (const r of results) {
        if (r.status === "fulfilled") fulfilled.push(r.value);
        else rejected.push(r.reason);
      }
      return { value: { fulfilled, rejected }, state };
    }

    return innerHandler(effect, context, state);
  };

  return composedHandler;
}
