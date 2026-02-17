import type { PluginContext, TypedNode } from "@mvfm/core";
import { z } from "zod";
import { ZodSchemaBuilder } from "./base";
import type { SchemaInterpreterMap } from "./interpreter-utils";
import type {
  CheckDescriptor,
  ErrorConfig,
  RefinementDescriptor,
  ZodSchemaNodeBase,
} from "./types";

interface ZodStringboolNode extends ZodSchemaNodeBase {
  kind: "zod/stringbool";
  truthy?: string[];
  falsy?: string[];
  coerce?: boolean;
}

/**
 * Builder for Zod stringbool schemas.
 *
 * Stringbool schemas coerce string values to booleans.
 * By default, "true"/"1"/"yes"/"on"/"y"/"enabled" map to `true`
 * and "false"/"0"/"no"/"off"/"n"/"disabled" map to `false`.
 * Custom truthy/falsy sets and case sensitivity can be configured.
 *
 * @typeParam T - The output type (boolean)
 */
export class ZodStringboolBuilder extends ZodSchemaBuilder<boolean> {
  constructor(
    ctx: PluginContext,
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super(ctx, "zod/stringbool", checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: string | TypedNode;
    extra?: Record<string, unknown>;
  }): ZodStringboolBuilder {
    return new ZodStringboolBuilder(
      this._ctx,
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }
}

/** Node kinds contributed by the stringbool schema. */
export const stringboolNodeKinds: string[] = ["zod/stringbool"];

/** Options for stringbool schema construction. */
export interface StringboolOptions {
  /** Custom truthy string values. */
  truthy?: string[];
  /** Custom falsy string values. */
  falsy?: string[];
  /** Whether matching is case-sensitive (default: coerces case). */
  coerce?: boolean;
}

/**
 * Namespace fragment for stringbool schema factories.
 */
export interface ZodStringboolNamespace {
  /**
   * Create a stringbool schema that coerces strings to booleans.
   *
   * @example
   * ```ts
   * $.zod.stringbool()               // "true"→true, "false"→false
   * $.zod.stringbool({ truthy: ["yep"], falsy: ["nope"] })
   * ```
   */
  stringbool(opts?: StringboolOptions): ZodStringboolBuilder;
}

/** Build the stringbool namespace factory methods. */
export function stringboolNamespace(ctx: PluginContext): ZodStringboolNamespace {
  return {
    stringbool(opts?: StringboolOptions): ZodStringboolBuilder {
      const extra: Record<string, unknown> = {};
      if (opts?.truthy) extra.truthy = opts.truthy;
      if (opts?.falsy) extra.falsy = opts.falsy;
      if (opts?.coerce !== undefined) extra.coerce = opts.coerce;
      return new ZodStringboolBuilder(ctx, [], [], undefined, extra);
    },
  };
}

/** Interpreter handlers for stringbool schema nodes. */
export const stringboolInterpreter: SchemaInterpreterMap = {
  // biome-ignore lint/correctness/useYield: conforms to SchemaInterpreterMap generator signature
  "zod/stringbool": async function* (
    node: ZodStringboolNode,
  ): AsyncGenerator<TypedNode, z.ZodType, unknown> {
    const opts: Record<string, unknown> = {};
    if (node.truthy) opts.truthy = node.truthy;
    if (node.falsy) opts.falsy = node.falsy;
    if (node.coerce !== undefined) opts.coerce = node.coerce;
    return Object.keys(opts).length > 0 ? z.stringbool(opts) : z.stringbool();
  },
};
