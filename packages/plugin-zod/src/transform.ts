import type { ASTNode, Expr, PluginContext } from "@mvfm/core";
import { ZodSchemaBuilder, ZodWrappedBuilder } from "./base";
import type { CheckDescriptor, ErrorConfig, RefinementDescriptor, WrapperASTNode } from "./types";

/**
 * Builder for standalone Zod transform schemas.
 *
 * Represents a transform that accepts any input and produces a typed output.
 * Used for `$.zod.transform(fn)`.
 *
 * @typeParam T - The output type
 */
export class ZodTransformBuilder<T> extends ZodSchemaBuilder<T> {
  constructor(
    ctx: PluginContext,
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super(ctx, "zod/transform", checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: string | ASTNode;
    extra?: Record<string, unknown>;
  }): ZodTransformBuilder<T> {
    return new ZodTransformBuilder<T>(
      this._ctx,
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }
}

/**
 * Build a standalone transform. Creates a lambda from the callback.
 */
export function buildStandaloneTransform<T>(
  ctx: PluginContext,
  fn: (val: Expr<unknown>) => Expr<T>,
): ZodTransformBuilder<T> {
  const paramNode: ASTNode = { kind: "core/lambda_param", name: "transform_val" };
  const paramProxy = ctx.expr<unknown>(paramNode);
  const result = fn(paramProxy);
  const bodyNode = ctx.isExpr(result) ? result.__node : paramNode;
  return new ZodTransformBuilder<T>(ctx, [], [], undefined, {
    fn: { kind: "core/lambda", param: paramNode, body: bodyNode },
  });
}

/**
 * Build a preprocess node. Creates a lambda from the callback and wraps the target schema.
 */
export function buildPreprocess<T>(
  ctx: PluginContext,
  fn: (val: Expr<unknown>) => Expr<unknown>,
  schema: ZodSchemaBuilder<T>,
): ZodWrappedBuilder<T> {
  const paramNode: ASTNode = { kind: "core/lambda_param", name: "preprocess_val" };
  const paramProxy = ctx.expr<unknown>(paramNode);
  const result = fn(paramProxy);
  const bodyNode = ctx.isExpr(result) ? result.__node : paramNode;
  const wrapperNode: WrapperASTNode = {
    kind: "zod/preprocess",
    inner: schema.__schemaNode,
    fn: { kind: "core/lambda", param: paramNode, body: bodyNode },
  };
  return new ZodWrappedBuilder<T>(ctx, wrapperNode);
}

/** Node kinds contributed by the transform/pipe/preprocess module. */
export const transformNodeKinds: string[] = ["zod/transform", "zod/pipe", "zod/preprocess"];

/**
 * Namespace fragment for transform, pipe, and preprocess factories.
 */
export interface ZodTransformNamespace {
  /** Create a standalone transform that accepts any input and produces typed output. */
  transform<T>(fn: (val: Expr<unknown>) => Expr<T>): ZodTransformBuilder<T>;

  /** Create a preprocess wrapper that transforms input before validating with the given schema. */
  preprocess<T>(
    fn: (val: Expr<unknown>) => Expr<unknown>,
    schema: ZodSchemaBuilder<T>,
  ): ZodWrappedBuilder<T>;
}

/** Build the transform namespace factory methods. */
export function transformNamespace(ctx: PluginContext): ZodTransformNamespace {
  return {
    transform<T>(fn: (val: Expr<unknown>) => Expr<T>): ZodTransformBuilder<T> {
      return buildStandaloneTransform(ctx, fn);
    },
    preprocess<T>(
      fn: (val: Expr<unknown>) => Expr<unknown>,
      schema: ZodSchemaBuilder<T>,
    ): ZodWrappedBuilder<T> {
      return buildPreprocess(ctx, fn, schema);
    },
  };
}
