import type { Expr, PluginContext, TypedNode } from "@mvfm/core";
import { z } from "zod";
import { ZodSchemaBuilder, ZodWrappedBuilder } from "./base";
import type { SchemaInterpreterMap } from "./interpreter-utils";
import type {
  CheckDescriptor,
  ErrorConfig,
  RefinementDescriptor,
  WrapperASTNode,
  ZodSchemaNodeBase,
} from "./types";

interface ZodAnyNode extends ZodSchemaNodeBase {
  kind: "zod/any";
}

interface ZodUnknownNode extends ZodSchemaNodeBase {
  kind: "zod/unknown";
}

interface ZodNeverNode extends ZodSchemaNodeBase {
  kind: "zod/never";
}

interface ZodCustomNode extends ZodSchemaNodeBase {
  kind: "zod/custom";
}

/**
 * Builder for simple Zod schema types with no type-specific methods.
 *
 * Used for `any`, `unknown`, `never`, and `nan` schemas.
 * These schemas have no additional check methods — only the
 * inherited base methods (parse, safeParse, refine, optional, etc.).
 *
 * @typeParam T - The output type this schema validates to
 */
export class ZodSimpleBuilder<T> extends ZodSchemaBuilder<T> {
  constructor(
    ctx: PluginContext,
    kind: string,
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super(ctx, kind, checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: string | TypedNode;
    extra?: Record<string, unknown>;
  }): ZodSimpleBuilder<T> {
    return new ZodSimpleBuilder<T>(
      this._ctx,
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
 * Produces a `zod/promise` wrapper node.
 */
export function buildPromise<T>(
  ctx: PluginContext,
  inner: ZodSchemaBuilder<T>,
): ZodWrappedBuilder<Promise<T>> {
  const wrapperNode: WrapperASTNode = {
    kind: "zod/promise",
    inner: inner.__schemaNode,
  };
  return new ZodWrappedBuilder<Promise<T>>(ctx, wrapperNode);
}

/**
 * Build a custom schema with a DSL predicate callback.
 * The callback receives an `Expr<unknown>` placeholder and must return
 * an `Expr<boolean>` built from DSL operations.
 */
export function buildCustom<T>(
  ctx: PluginContext,
  fn: (val: Expr<unknown>) => Expr<boolean>,
  errorOrOpts?: string | { error?: string },
): ZodSimpleBuilder<T> {
  const paramNode = { kind: "core/lambda_param", name: "custom_val" } as TypedNode;
  const paramProxy = ctx.expr<unknown>(paramNode);
  const result = fn(paramProxy);
  const bodyNode = ctx.isExpr(result) ? result.__node : paramNode;
  const error = typeof errorOrOpts === "string" ? errorOrOpts : errorOrOpts?.error;
  return new ZodSimpleBuilder<T>(ctx, "zod/custom", [], [], error, {
    predicate: { kind: "core/lambda", param: paramNode, body: bodyNode },
  });
}

/** Node kinds contributed by the special schema types. */
export const specialNodeKinds: string[] = [
  "zod/any",
  "zod/unknown",
  "zod/never",
  "zod/promise",
  "zod/custom",
];

/**
 * Namespace fragment for special schema factories.
 * Note: `nan` is handled by the number module (ZodNumberNamespace).
 */
export interface ZodSpecialNamespace {
  /** Create an `any` schema that accepts all values. */
  any(): ZodSimpleBuilder<any>;
  /** Create an `unknown` schema that accepts all values (type-safe). */
  unknown(): ZodSimpleBuilder<unknown>;
  /** Create a `never` schema that rejects all values. */
  never(): ZodSimpleBuilder<never>;
  /** Create a `promise` schema that wraps an inner schema. */
  promise<T>(inner: ZodSchemaBuilder<T>): ZodWrappedBuilder<Promise<T>>;
  /** Create a custom schema with a DSL predicate. */
  custom<T = unknown>(
    fn: (val: Expr<unknown>) => Expr<boolean>,
    errorOrOpts?: string | { error?: string },
  ): ZodSimpleBuilder<T>;
}

/** Build the special namespace factory methods. */
export function specialNamespace(
  ctx: PluginContext,
  _parseError: (errorOrOpts?: string | { error?: string }) => string | undefined,
): ZodSpecialNamespace {
  return {
    any(): ZodSimpleBuilder<any> {
      return new ZodSimpleBuilder<any>(ctx, "zod/any");
    },
    unknown(): ZodSimpleBuilder<unknown> {
      return new ZodSimpleBuilder<unknown>(ctx, "zod/unknown");
    },
    never(): ZodSimpleBuilder<never> {
      return new ZodSimpleBuilder<never>(ctx, "zod/never");
    },
    promise<T>(inner: ZodSchemaBuilder<T>): ZodWrappedBuilder<Promise<T>> {
      return buildPromise(ctx, inner);
    },
    custom<T = unknown>(
      fn: (val: Expr<unknown>) => Expr<boolean>,
      errorOrOpts?: string | { error?: string },
    ): ZodSimpleBuilder<T> {
      return buildCustom<T>(ctx, fn, errorOrOpts);
    },
  };
}

/** Interpreter handlers for special schema nodes. */
export const specialInterpreter: SchemaInterpreterMap = {
  // biome-ignore lint/correctness/useYield: conforms to SchemaInterpreterMap generator signature
  "zod/any": async function* (_node: ZodAnyNode): AsyncGenerator<TypedNode, z.ZodType, unknown> {
    return z.any();
  },
  // biome-ignore lint/correctness/useYield: conforms to SchemaInterpreterMap generator signature
  "zod/unknown": async function* (
    _node: ZodUnknownNode,
  ): AsyncGenerator<TypedNode, z.ZodType, unknown> {
    return z.unknown();
  },
  // biome-ignore lint/correctness/useYield: conforms to SchemaInterpreterMap generator signature
  "zod/never": async function* (
    _node: ZodNeverNode,
  ): AsyncGenerator<TypedNode, z.ZodType, unknown> {
    return z.never();
  },
  // biome-ignore lint/correctness/useYield: conforms to SchemaInterpreterMap generator signature
  "zod/custom": async function* (
    _node: ZodCustomNode,
  ): AsyncGenerator<TypedNode, z.ZodType, unknown> {
    // Custom predicate is an AST lambda — evaluated post-validation via refinements
    // For the Zod schema, use z.any() as base and let refinements handle the predicate
    return z.any();
  },
};
