import type { PluginContext, TypedNode } from "@mvfm/core";
import { z } from "zod";
import { ZodSchemaBuilder } from "./base";
import type { SchemaInterpreterMap } from "./interpreter-utils";
import type { CheckDescriptor, ErrorConfig, RefinementDescriptor } from "./types";

/** Primitive types allowed as literal values. */
type LiteralValue = string | number | bigint | boolean;

/**
 * Builder for Zod literal schemas.
 *
 * Supports single-value literals (`$.zod.literal("tuna")`) and
 * multi-value literals (`$.zod.literal(["red", "green"])`).
 *
 * The AST stores the value(s) directly in the `value` field of the
 * schema node. Multi-value literals produce a union of literal types.
 *
 * @typeParam T - The literal type(s) this schema validates to
 */
export class ZodLiteralBuilder<T extends LiteralValue> extends ZodSchemaBuilder<T> {
  constructor(
    ctx: PluginContext,
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super(ctx, "zod/literal", checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: string | TypedNode;
    extra?: Record<string, unknown>;
  }): ZodLiteralBuilder<T> {
    return new ZodLiteralBuilder<T>(
      this._ctx,
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }
}

/** Node kinds contributed by the literal schema. */
export const literalNodeKinds: string[] = ["zod/literal"];

/**
 * Namespace fragment for literal schema factories.
 */
export interface ZodLiteralNamespace {
  /**
   * Create a literal schema for one or more fixed values.
   *
   * @example
   * ```ts
   * $.zod.literal("tuna")           // type: "tuna"
   * $.zod.literal(42)               // type: 42
   * $.zod.literal(true)             // type: true
   * $.zod.literal(["red", "green"]) // type: "red" | "green"
   * ```
   */
  literal<T extends LiteralValue>(value: T | T[]): ZodLiteralBuilder<T>;
}

/** Build the literal namespace factory methods. */
export function literalNamespace(ctx: PluginContext): ZodLiteralNamespace {
  return {
    literal<T extends LiteralValue>(value: T | T[]): ZodLiteralBuilder<T> {
      return new ZodLiteralBuilder<T>(ctx, [], [], undefined, { value });
    },
  };
}

/** Interpreter handlers for literal schema nodes. */
export const literalInterpreter: SchemaInterpreterMap = {
  // biome-ignore lint/correctness/useYield: conforms to SchemaInterpreterMap generator signature
  "zod/literal": async function* (node: any): AsyncGenerator<TypedNode, z.ZodType, unknown> {
    const value = node.value;
    if (Array.isArray(value)) {
      return z.literal(value as [string, ...string[]]);
    }
    return z.literal(value as string | number | bigint | boolean);
  },
};
