import type { CExpr } from "@mvfm/core";
import { isCExpr, makeCExpr } from "@mvfm/core";
import { z } from "zod";
import { ZodSchemaBuilder, ZodWrappedBuilder } from "./base";
import type { SchemaInterpreterMap } from "./interpreter-utils";
import type { CheckDescriptor, ErrorConfig, RefinementDescriptor, WrapperASTNode } from "./types";

/**
 * Builder for simple Zod schema types with no type-specific methods.
 */
export class ZodSimpleBuilder<T> extends ZodSchemaBuilder<T> {
  constructor(
    kind: string,
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super(kind, checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: ErrorConfig;
    extra?: Record<string, unknown>;
  }): ZodSimpleBuilder<T> {
    return new ZodSimpleBuilder<T>(
      this._kind,
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }
}

/**
 * Build a promise schema wrapper around an inner schema.
 */
export function buildPromise<T>(inner: ZodSchemaBuilder<T>): ZodWrappedBuilder<Promise<T>> {
  const wrapperNode: WrapperASTNode = {
    kind: "zod/promise",
    inner: inner.__schemaNode,
  };
  return new ZodWrappedBuilder<Promise<T>>(wrapperNode);
}

/**
 * Build a custom schema with a DSL predicate callback.
 */
export function buildCustom<T>(
  fn: (val: CExpr<unknown>) => CExpr<boolean>,
  errorOrOpts?: string | { error?: string },
): ZodSimpleBuilder<T> {
  const param = makeCExpr<unknown, "core/lambda_param", []>("core/lambda_param", []);
  const result = fn(param);
  const body = isCExpr(result) ? result : param;
  const error = typeof errorOrOpts === "string" ? errorOrOpts : errorOrOpts?.error;
  return new ZodSimpleBuilder<T>("zod/custom", [], [], error, {
    predicate: { param, body },
  });
}

/** Build the special namespace factory methods. */
export function specialNamespace(
  _parseError: (errorOrOpts?: string | { error?: string }) => string | undefined,
) {
  return {
    any: () => new ZodSimpleBuilder<any>("zod/any"),
    unknown: () => new ZodSimpleBuilder<unknown>("zod/unknown"),
    never: () => new ZodSimpleBuilder<never>("zod/never"),
    promise: <T>(inner: ZodSchemaBuilder<T>) => buildPromise(inner),
    custom: <T = unknown>(
      fn: (val: CExpr<unknown>) => CExpr<boolean>,
      errorOrOpts?: string | { error?: string },
    ) => buildCustom<T>(fn, errorOrOpts),
  };
}

export const specialInterpreter: SchemaInterpreterMap = {
  "zod/any": async function* () {
    return z.any();
  },
  "zod/unknown": async function* () {
    return z.unknown();
  },
  "zod/never": async function* () {
    return z.never();
  },
  "zod/custom": async function* () {
    return z.any();
  },
};
