// ============================================================
// MVFM — Proxy engine for DSL expression building
// ============================================================

import type { Expr, PluginContext } from "./types";
import { MVFM } from "./types";

/**
 * Check if a value is already an Expr (branded with MVFM symbol).
 */
export function isExpr(value: unknown): value is Expr<unknown> {
  return value !== null && typeof value === "object" && MVFM in (value as Record<symbol, unknown>);
}

/**
 * Auto-lift a raw JS value to Expr if it isn't already.
 *
 * - Primitives (number, string, boolean, null) → `core/literal`
 * - Arrays → `core/tuple`
 * - Objects → `core/record`
 * - Already Expr → pass through
 */
export function autoLift<T>(value: T | Expr<T>, exprFn: PluginContext["expr"]): Expr<T> {
  if (isExpr(value)) return value as Expr<T>;

  const jsType = typeof value;
  if (jsType === "number" || jsType === "string" || jsType === "boolean" || value === null) {
    return exprFn<T>({ kind: "core/literal", value });
  }

  if (Array.isArray(value)) {
    return exprFn<T>({
      kind: "core/tuple",
      elements: value.map((v) => autoLift(v, exprFn).__node),
    });
  }

  if (jsType === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(([k, v]) => [
      k,
      isExpr(v) ? (v as Expr<unknown>).__node : autoLift(v, exprFn).__node,
    ]);
    return exprFn<T>({
      kind: "core/record",
      fields: Object.fromEntries(entries),
    });
  }

  throw new Error(`Cannot auto-lift value of type ${jsType} into Mvfm expression`);
}

/**
 * Make an Expr<T> proxy that intercepts property access to
 * build PropAccess nodes, and method calls to build
 * MethodCall nodes.
 */
export function makeExprProxy<T>(node: any, ctx: PluginContext): Expr<T> {
  const target = {
    [MVFM]: true as const,
    __type: undefined as unknown as T,
    __node: node,
  };

  return new Proxy(target, {
    get(_target, prop) {
      if (prop === MVFM) return true;
      if (prop === "__node") return node;
      if (prop === "__type") return undefined;
      if (typeof prop === "symbol") return undefined;

      const callbackMethods = [
        "map",
        "filter",
        "reduce",
        "find",
        "findIndex",
        "some",
        "every",
        "flatMap",
        "forEach",
      ];

      if (callbackMethods.includes(prop)) {
        return (...args: unknown[]) => {
          const processedArgs = args.map((arg, i) => {
            if (typeof arg === "function") {
              const paramNode: any = {
                kind: "core/lambda_param",
                index: i,
                parentMethod: prop,
              };
              const paramProxy = makeExprProxy(paramNode, ctx);

              if (prop === "reduce" && args.length > 1 && i === 0) {
                const accNode: any = {
                  kind: "core/lambda_param",
                  name: "accumulator",
                };
                const accProxy = makeExprProxy(accNode, ctx);
                const itemNode: any = {
                  kind: "core/lambda_param",
                  name: "item",
                };
                const itemProxy = makeExprProxy(itemNode, ctx);
                const result = (arg as Function)(accProxy, itemProxy);
                return {
                  kind: "core/lambda" as const,
                  params: [accNode, itemNode],
                  body: isExpr(result) ? result.__node : autoLift(result, ctx.expr).__node,
                };
              }

              const result = (arg as Function)(paramProxy);
              return {
                kind: "core/lambda" as const,
                params: [paramNode],
                body: isExpr(result) ? result.__node : autoLift(result, ctx.expr).__node,
              };
            }
            return isExpr(arg)
              ? (arg as Expr<unknown>).__node
              : { kind: "core/literal", value: arg };
          });

          return makeExprProxy(
            {
              kind: "core/method_call",
              receiver: node,
              method: prop,
              args: processedArgs,
            },
            ctx,
          );
        };
      }

      return makeExprProxy<unknown>(
        {
          kind: "core/prop_access",
          object: node,
          property: prop,
        },
        ctx,
      );
    },
  }) as unknown as Expr<T>;
}
