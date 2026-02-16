import type { PluginContext, TypedNode } from "@mvfm/core";
import { z } from "zod";
import { ZodSchemaBuilder } from "./base";
import type { SchemaInterpreterMap } from "./interpreter-utils";
import { toZodError } from "./interpreter-utils";
import type { CheckDescriptor, ErrorConfig, RefinementDescriptor } from "./types";

/**
 * Builder for simple Zod primitive schemas with no type-specific methods.
 *
 * Used for `boolean`, `null`, `undefined`, `void`, and `symbol` schemas.
 * These schemas have no additional check methods -- only the
 * inherited base methods (parse, safeParse, refine, optional, etc.).
 *
 * @typeParam T - The output type this schema validates to
 */
export class ZodPrimitiveBuilder<T> extends ZodSchemaBuilder<T> {
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
  }): ZodPrimitiveBuilder<T> {
    return new ZodPrimitiveBuilder<T>(
      this._ctx,
      this._kind,
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }
}

/** Node kinds contributed by the primitives schema types. */
export const primitivesNodeKinds: string[] = [
  "zod/boolean",
  "zod/null",
  "zod/undefined",
  "zod/void",
  "zod/symbol",
];

/**
 * Namespace fragment for primitive schema factories.
 */
export interface ZodPrimitivesNamespace {
  /** Create a boolean schema builder. */
  boolean(errorOrOpts?: string | { error?: string }): ZodPrimitiveBuilder<boolean>;
  /** Create a null schema builder. */
  null(errorOrOpts?: string | { error?: string }): ZodPrimitiveBuilder<null>;
  /** Create an undefined schema builder. */
  undefined(errorOrOpts?: string | { error?: string }): ZodPrimitiveBuilder<undefined>;
  /** Create a void schema builder (alias for undefined). */
  void(errorOrOpts?: string | { error?: string }): ZodPrimitiveBuilder<void>;
  /** Create a symbol schema builder. */
  symbol(errorOrOpts?: string | { error?: string }): ZodPrimitiveBuilder<symbol>;
}

/** Build the primitives namespace factory methods. */
export function primitivesNamespace(
  ctx: PluginContext,
  parseError: (errorOrOpts?: string | { error?: string }) => string | undefined,
): ZodPrimitivesNamespace {
  return {
    boolean(errorOrOpts?: string | { error?: string }): ZodPrimitiveBuilder<boolean> {
      return new ZodPrimitiveBuilder<boolean>(ctx, "zod/boolean", [], [], parseError(errorOrOpts));
    },
    null(errorOrOpts?: string | { error?: string }): ZodPrimitiveBuilder<null> {
      return new ZodPrimitiveBuilder<null>(ctx, "zod/null", [], [], parseError(errorOrOpts));
    },
    undefined(errorOrOpts?: string | { error?: string }): ZodPrimitiveBuilder<undefined> {
      return new ZodPrimitiveBuilder<undefined>(
        ctx,
        "zod/undefined",
        [],
        [],
        parseError(errorOrOpts),
      );
    },
    void(errorOrOpts?: string | { error?: string }): ZodPrimitiveBuilder<void> {
      return new ZodPrimitiveBuilder<void>(ctx, "zod/void", [], [], parseError(errorOrOpts));
    },
    symbol(errorOrOpts?: string | { error?: string }): ZodPrimitiveBuilder<symbol> {
      return new ZodPrimitiveBuilder<symbol>(ctx, "zod/symbol", [], [], parseError(errorOrOpts));
    },
  };
}

/** Interpreter handlers for primitive schema nodes. */
export const primitivesInterpreter: SchemaInterpreterMap = {
  // biome-ignore lint/correctness/useYield: conforms to SchemaInterpreterMap generator signature
  "zod/boolean": async function* (node: any): AsyncGenerator<TypedNode, z.ZodType, unknown> {
    const errorFn = toZodError(node.error as ErrorConfig | undefined);
    return errorFn ? z.boolean({ error: errorFn }) : z.boolean();
  },
  // biome-ignore lint/correctness/useYield: conforms to SchemaInterpreterMap generator signature
  "zod/null": async function* (_node: any): AsyncGenerator<TypedNode, z.ZodType, unknown> {
    return z.null();
  },
  // biome-ignore lint/correctness/useYield: conforms to SchemaInterpreterMap generator signature
  "zod/undefined": async function* (_node: any): AsyncGenerator<TypedNode, z.ZodType, unknown> {
    return z.undefined();
  },
  // biome-ignore lint/correctness/useYield: conforms to SchemaInterpreterMap generator signature
  "zod/void": async function* (_node: any): AsyncGenerator<TypedNode, z.ZodType, unknown> {
    return z.void();
  },
  // biome-ignore lint/correctness/useYield: conforms to SchemaInterpreterMap generator signature
  "zod/symbol": async function* (_node: any): AsyncGenerator<TypedNode, z.ZodType, unknown> {
    return z.symbol();
  },
};
