import type { ASTNode, InterpreterFragment, StepEffect, StepHandler } from "../../core";
import { runAST } from "../../core";
import { injectLambdaParam } from "./interpreter";

/**
 * Effect handler for fiber/ effects (concurrency).
 *
 * Provides true parallel execution semantics when used with {@link runAST}:
 * - `fiber/par_map`: Batched `Promise.all` with bounded concurrency
 * - `fiber/race`: `Promise.race` over branches
 * - `fiber/timeout`: `Promise.race` between expression and timer
 * - `fiber/retry`: Loop with delay between attempts
 *
 * Composes with an inner handler: all non-fiber effects are delegated unchanged.
 *
 * Note: When using {@link composeInterpreters}, the fiber interpreter handles
 * these operations sequentially within the generator. Use this handler with
 * {@link runAST} for true parallel execution.
 *
 * @param fragments - Interpreter fragments for evaluating sub-expressions.
 * @param innerHandler - The handler to delegate non-fiber effects to.
 * @returns A composed {@link StepHandler}.
 */
export function fiberHandler(
  fragments: InterpreterFragment[],
  innerHandler: StepHandler<any>,
): StepHandler<any> {
  const composedHandler: StepHandler<any> = async (effect: StepEffect, context, state) => {
    switch (effect.type) {
      case "fiber/par_map": {
        const e = effect as any;
        // Resolve the collection first
        const { value: collection } = await runAST(
          e.collection,
          fragments,
          composedHandler,
          undefined,
        );
        const items = collection as unknown[];
        const concurrency = e.concurrency as number;
        const results: unknown[] = [];

        for (let i = 0; i < items.length; i += concurrency) {
          const batch = items.slice(i, i + concurrency);
          const batchResults = await Promise.all(
            batch.map((item) => {
              const bodyClone = structuredClone(e.body);
              injectLambdaParam(bodyClone, (e.param as any).name, item);
              return runAST(bodyClone, fragments, composedHandler, undefined).then((r) => r.value);
            }),
          );
          results.push(...batchResults);
        }
        return { value: results, state };
      }

      case "fiber/race": {
        const branches = (effect as any).branches as ASTNode[];
        const value = await Promise.race(
          branches.map((b) =>
            runAST(b, fragments, composedHandler, undefined).then((r) => r.value),
          ),
        );
        return { value, state };
      }

      case "fiber/timeout": {
        const e = effect as any;
        const { value: ms } = await runAST(e.ms, fragments, composedHandler, undefined);
        const expr = runAST(e.expr, fragments, composedHandler, undefined).then((r) => r.value);
        let timerId: ReturnType<typeof setTimeout>;
        const timer = new Promise<unknown>((resolve) => {
          timerId = setTimeout(async () => {
            const { value } = await runAST(e.fallback, fragments, composedHandler, undefined);
            resolve(value);
          }, ms as number);
        });
        const value = await Promise.race([expr, timer]).finally(() => clearTimeout(timerId!));
        return { value, state };
      }

      case "fiber/retry": {
        const e = effect as any;
        const attempts = e.attempts as number;
        const delay = e.delay as number;
        let lastError: unknown;
        for (let i = 0; i < attempts; i++) {
          try {
            const exprClone = structuredClone(e.expr);
            const { value } = await runAST(exprClone, fragments, composedHandler, undefined);
            return { value, state };
          } catch (err) {
            lastError = err;
            if (i < attempts - 1 && delay > 0) {
              await new Promise((r) => setTimeout(r, delay));
            }
          }
        }
        throw lastError;
      }

      default:
        return innerHandler(effect, context, state);
    }
  };

  return composedHandler;
}
