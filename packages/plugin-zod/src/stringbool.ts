import type { PluginContext, TypedNode } from "@mvfm/core";
import { z } from "zod";
import { ZodSchemaBuilder } from "./base";
import type { SchemaInterpreterMap } from "./interpreter-utils";
import { toZodError } from "./interpreter-utils";
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
  caseSensitive?: boolean;
}

/**
 * Builder for Zod stringbool schemas.
 *
 * Coerces string values to boolean based on truthy/falsy lists.
 * Default truthy: "true", "1", "yes", "on", "y", "enabled"
 * Default falsy: "false", "0", "no", "off", "n", "disabled"
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

/** Node kinds contributed by stringbool schemas. */
export const stringboolNodeKinds: string[] = ["zod/stringbool"];

/**
 * Namespace fragment for stringbool schema factory.
 */
export interface ZodStringboolNamespace {
  /**
   * Create a stringbool schema.
   *
   * Coerces strings to booleans based on truthy/falsy values.
   * Defaults to case-insensitive matching with common truthy/falsy strings.
   */
  stringbool(options?: {
    truthy?: string[];
    falsy?: string[];
    case?: "sensitive" | "insensitive";
    error?: string;
  }): ZodStringboolBuilder;
}

/** Build the stringbool namespace factory method. */
export function stringboolNamespace(
  ctx: PluginContext,
  _parseError: (errorOrOpts?: string | { error?: string }) => string | undefined,
): ZodStringboolNamespace {
  return {
    stringbool(options?: {
      truthy?: string[];
      falsy?: string[];
      case?: "sensitive" | "insensitive";
      error?: string;
    }): ZodStringboolBuilder {
      const caseSensitive = options?.case === "sensitive";
      return new ZodStringboolBuilder(ctx, [], [], options?.error, {
        truthy: options?.truthy,
        falsy: options?.falsy,
        caseSensitive,
      });
    },
  };
}

/** Interpreter for stringbool schemas. */
export const stringboolInterpreter: SchemaInterpreterMap = {
  "zod/stringbool": async function* (
    node: ZodStringboolNode,
  ): AsyncGenerator<TypedNode, z.ZodType, unknown> {
    const { truthy, falsy, caseSensitive, error } = node;

    // Default truthy/falsy values
    const defaultTruthy = ["true", "1", "yes", "on", "y", "enabled"];
    const defaultFalsy = ["false", "0", "no", "off", "n", "disabled"];

    const truthyValues = truthy ?? defaultTruthy;
    const falsyValues = falsy ?? defaultFalsy;
    const isCaseSensitive = caseSensitive ?? false;

    const errorFn = toZodError(error);
    const errOpt = errorFn ? { error: errorFn } : {};

    // Create a custom schema that transforms strings to booleans
    return z.string(errOpt).transform((val, ctx) => {
      const testValue = isCaseSensitive ? val : val.toLowerCase();
      const truthySet = new Set(
        isCaseSensitive ? truthyValues : truthyValues.map((v) => v.toLowerCase()),
      );
      const falsySet = new Set(
        isCaseSensitive ? falsyValues : falsyValues.map((v) => v.toLowerCase()),
      );

      if (truthySet.has(testValue)) {
        return true;
      }
      if (falsySet.has(testValue)) {
        return false;
      }

      // Invalid value - add an issue
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          errorFn?.(ctx) ??
          `Invalid boolean string: expected one of ${[...truthyValues, ...falsyValues].join(", ")}`,
      });
      return z.NEVER;
    });
  },
};
