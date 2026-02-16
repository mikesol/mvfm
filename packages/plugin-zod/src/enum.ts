import type { PluginContext, TypedNode } from "@mvfm/core";
import { z } from "zod";
import { ZodSchemaBuilder } from "./base";
import type { SchemaInterpreterMap } from "./interpreter-utils";
import { toZodError } from "./interpreter-utils";
import type { CheckDescriptor, ErrorConfig, RefinementDescriptor } from "./types";

/**
 * Builder for Zod enum schemas.
 *
 * Validates that input is one of a fixed set of string values.
 * Supports `.extract()` and `.exclude()` for deriving sub-enums.
 *
 * @typeParam T - Union of the allowed string values
 */
export class ZodEnumBuilder<T extends string> extends ZodSchemaBuilder<T> {
  constructor(
    ctx: PluginContext,
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super(ctx, "zod/enum", checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: string | TypedNode;
    extra?: Record<string, unknown>;
  }): ZodEnumBuilder<T> {
    return new ZodEnumBuilder<T>(
      this._ctx,
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }

  /** Create a new enum with only the specified values. */
  extract<U extends T>(values: U[]): ZodEnumBuilder<U> {
    return new ZodEnumBuilder<U>(this._ctx, [], [], this._error, {
      ...this._extra,
      values,
    });
  }

  /** Create a new enum without the specified values. */
  exclude<U extends T>(values: U[]): ZodEnumBuilder<Exclude<T, U>> {
    const current = (this._extra.values as T[]) ?? [];
    const remaining = current.filter((v) => !values.includes(v as U));
    return new ZodEnumBuilder<Exclude<T, U>>(this._ctx, [], [], this._error, {
      ...this._extra,
      values: remaining,
    });
  }
}

/**
 * Builder for Zod native enum schemas.
 *
 * Validates that input is one of the values from a TypeScript enum
 * or object literal with string/number values.
 *
 * @typeParam T - The output type (union of enum values)
 */
export class ZodNativeEnumBuilder<T> extends ZodSchemaBuilder<T> {
  constructor(
    ctx: PluginContext,
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super(ctx, "zod/native_enum", checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: string | TypedNode;
    extra?: Record<string, unknown>;
  }): ZodNativeEnumBuilder<T> {
    return new ZodNativeEnumBuilder<T>(
      this._ctx,
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }
}

/** Node kinds contributed by enum schemas. */
export const enumNodeKinds: string[] = ["zod/enum", "zod/native_enum"];

/**
 * Namespace fragment for enum schema factories.
 */
export interface ZodEnumNamespace {
  /**
   * Create an enum schema from string values.
   * Validates that input matches one of the provided strings.
   */
  enum<T extends string>(values: T[], errorOrOpts?: string | { error?: string }): ZodEnumBuilder<T>;

  /**
   * Create a native enum schema from a TypeScript enum or object literal.
   * Validates that input matches one of the enum's values.
   */
  nativeEnum<T extends Record<string, string | number>>(
    enumObj: T,
    errorOrOpts?: string | { error?: string },
  ): ZodNativeEnumBuilder<T[keyof T]>;
}

/** Build the enum namespace factory methods. */
export function enumNamespace(
  ctx: PluginContext,
  parseError: (errorOrOpts?: string | { error?: string }) => string | undefined,
): ZodEnumNamespace {
  return {
    enum<T extends string>(
      values: T[],
      errorOrOpts?: string | { error?: string },
    ): ZodEnumBuilder<T> {
      return new ZodEnumBuilder<T>(ctx, [], [], parseError(errorOrOpts), { values });
    },

    nativeEnum<T extends Record<string, string | number>>(
      enumObj: T,
      errorOrOpts?: string | { error?: string },
    ): ZodNativeEnumBuilder<T[keyof T]> {
      return new ZodNativeEnumBuilder<T[keyof T]>(ctx, [], [], parseError(errorOrOpts), {
        entries: enumObj,
      });
    },
  };
}

/** Interpreter handlers for enum schema nodes. */
export const enumInterpreter: SchemaInterpreterMap = {
  // biome-ignore lint/correctness/useYield: conforms to SchemaInterpreterMap generator signature
  "zod/enum": async function* (node: any): AsyncGenerator<TypedNode, z.ZodType, unknown> {
    const values = node.values as [string, ...string[]];
    const errorFn = toZodError(node.error as ErrorConfig | undefined);
    const errOpt = errorFn ? { error: errorFn } : {};
    return z.enum(values, errOpt);
  },

  // biome-ignore lint/correctness/useYield: conforms to SchemaInterpreterMap generator signature
  "zod/native_enum": async function* (node: any): AsyncGenerator<TypedNode, z.ZodType, unknown> {
    const entries = node.entries as Record<string, string | number>;
    const errorFn = toZodError(node.error as ErrorConfig | undefined);
    const errOpt = errorFn ? { error: errorFn } : {};
    return z.nativeEnum(entries, errOpt);
  },
};
