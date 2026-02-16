import type { PluginContext, TypedNode } from "@mvfm/core";
import { z } from "zod";
import { ZodSchemaBuilder } from "./base";
import type { SchemaInterpreterMap } from "./interpreter-utils";
import { checkErrorOpt, toZodError } from "./interpreter-utils";
import type { CheckDescriptor, ErrorConfig, RefinementDescriptor } from "./types";

/**
 * Builder for Zod array schemas.
 *
 * Provides array-specific length constraint methods: min, max, length.
 * The element schema is stored as an AST node in the `element` extra field.
 *
 * @typeParam T - The element type of the array
 */
export class ZodArrayBuilder<T> extends ZodSchemaBuilder<T[]> {
  constructor(
    ctx: PluginContext,
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super(ctx, "zod/array", checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: string | TypedNode;
    extra?: Record<string, unknown>;
  }): ZodArrayBuilder<T> {
    return new ZodArrayBuilder<T>(
      this._ctx,
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }

  /** Require at least `value` elements. Produces `min_length` check descriptor. */
  min(
    value: number,
    opts?: { error?: string; abort?: boolean; when?: TypedNode },
  ): ZodArrayBuilder<T> {
    return this._addCheck("min_length", { value }, opts) as ZodArrayBuilder<T>;
  }

  /** Require at most `value` elements. Produces `max_length` check descriptor. */
  max(
    value: number,
    opts?: { error?: string; abort?: boolean; when?: TypedNode },
  ): ZodArrayBuilder<T> {
    return this._addCheck("max_length", { value }, opts) as ZodArrayBuilder<T>;
  }

  /** Require exactly `value` elements. Produces `length` check descriptor. */
  length(
    value: number,
    opts?: { error?: string; abort?: boolean; when?: TypedNode },
  ): ZodArrayBuilder<T> {
    return this._addCheck("length", { value }, opts) as ZodArrayBuilder<T>;
  }
}

/** Node kinds contributed by the array schema. */
export const arrayNodeKinds: string[] = ["zod/array"];

/**
 * Namespace fragment for array schema factories.
 */
export interface ZodArrayNamespace {
  /** Create an array schema builder with the given element schema. */
  array<T>(
    element: ZodSchemaBuilder<T>,
    errorOrOpts?: string | { error?: string },
  ): ZodArrayBuilder<T>;
}

/** Build the array namespace factory methods. */
export function arrayNamespace(
  ctx: PluginContext,
  parseError: (errorOrOpts?: string | { error?: string }) => string | undefined,
): ZodArrayNamespace {
  return {
    array<T>(
      element: ZodSchemaBuilder<T>,
      errorOrOpts?: string | { error?: string },
    ): ZodArrayBuilder<T> {
      const error = parseError(errorOrOpts);
      return new ZodArrayBuilder<T>(ctx, [], [], error, {
        element: element.__schemaNode,
      });
    },
  };
}

/**
 * Apply check descriptors to a Zod array schema.
 */
function applyArrayChecks(schema: z.ZodArray, checks: CheckDescriptor[]): z.ZodArray {
  let s = schema;
  for (const check of checks) {
    const errOpt = checkErrorOpt(check);
    switch (check.kind) {
      case "min_length":
        s = s.min(check.value as number, errOpt);
        break;
      case "max_length":
        s = s.max(check.value as number, errOpt);
        break;
      case "length":
        s = s.length(check.value as number, errOpt);
        break;
      default:
        throw new Error(`Zod interpreter: unknown array check "${check.kind}"`);
    }
  }
  return s;
}

/**
 * Build a Zod schema from a field's AST node by delegating to the
 * interpreter's buildSchemaGen. This is passed in at registration time
 * to avoid circular imports.
 */
type SchemaBuildFn = (node: any) => AsyncGenerator<TypedNode, z.ZodType, unknown>;

/** Create array interpreter handlers with access to the shared schema builder. */
export function createArrayInterpreter(buildSchema: SchemaBuildFn): SchemaInterpreterMap {
  return {
    "zod/array": async function* (node: any): AsyncGenerator<TypedNode, z.ZodType, unknown> {
      const elementNode = node.element as any;
      const elementSchema = yield* buildSchema(elementNode);
      const checks = (node.checks as CheckDescriptor[]) ?? [];
      const errorFn = toZodError(node.error as ErrorConfig | undefined);
      const errOpt = errorFn ? { error: errorFn } : {};
      const arr = z.array(elementSchema, errOpt);
      return applyArrayChecks(arr, checks);
    },
  };
}
