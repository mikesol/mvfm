import type { CExpr } from "@mvfm/core";
import { isCExpr, makeCExpr } from "@mvfm/core";
import { ZodSchemaBuilder, ZodWrappedBuilder } from "./base";
import type { CheckDescriptor, ErrorConfig, RefinementDescriptor, WrapperASTNode } from "./types";

/**
 * Builder for standalone Zod transform schemas.
 */
export class ZodTransformBuilder<T> extends ZodSchemaBuilder<T> {
  constructor(
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super("zod/transform", checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: ErrorConfig;
    extra?: Record<string, unknown>;
  }): ZodTransformBuilder<T> {
    return new ZodTransformBuilder<T>(
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }
}

export function buildStandaloneTransform<T>(
  fn: (val: CExpr<unknown>) => CExpr<T>,
): ZodTransformBuilder<T> {
  const param = makeCExpr<unknown, "core/lambda_param", []>("core/lambda_param", []);
  const result = fn(param);
  const body = isCExpr(result) ? result : param;
  return new ZodTransformBuilder<T>([], [], undefined, { fn: { param, body } });
}

export function buildPreprocess<T>(
  fn: (val: CExpr<unknown>) => CExpr<unknown>,
  schema: ZodSchemaBuilder<T>,
): ZodWrappedBuilder<T> {
  const param = makeCExpr<unknown, "core/lambda_param", []>("core/lambda_param", []);
  const result = fn(param);
  const body = isCExpr(result) ? result : param;
  const wrapperNode: WrapperASTNode = {
    kind: "zod/preprocess",
    inner: schema.__schemaNode,
    fn: { param, body },
  };
  return new ZodWrappedBuilder<T>(wrapperNode);
}

/** Build the transform namespace factory methods. */
export function transformNamespace() {
  return {
    transform: <T>(fn: (val: CExpr<unknown>) => CExpr<T>) => buildStandaloneTransform(fn),
    preprocess: <T>(fn: (val: CExpr<unknown>) => CExpr<unknown>, schema: ZodSchemaBuilder<T>) =>
      buildPreprocess(fn, schema),
  };
}
