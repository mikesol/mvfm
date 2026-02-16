import type { ASTNode, PluginContext, StepEffect } from "@mvfm/core";
import { z } from "zod";
import { ZodSchemaBuilder } from "./base";
import type { SchemaInterpreterMap } from "./interpreter-utils";
import { checkErrorOpt, toZodError } from "./interpreter-utils";
import type { CheckDescriptor, ErrorConfig, RefinementDescriptor } from "./types";

/**
 * Builder for Zod date schemas.
 *
 * Supports min/max date constraints via check descriptors.
 * Date values in checks are stored as ISO strings for deterministic AST serialization.
 *
 * @example
 * ```ts
 * $.zod.date().min(new Date("2000-01-01")).max(new Date()).parse(input)
 * ```
 */
export class ZodDateBuilder extends ZodSchemaBuilder<Date> {
  constructor(
    ctx: PluginContext,
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super(ctx, "zod/date", checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: string | ASTNode;
    extra?: Record<string, unknown>;
  }): ZodDateBuilder {
    return new ZodDateBuilder(
      this._ctx,
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }

  /** Minimum date constraint. Produces `min` check descriptor with ISO string value. */
  min(value: Date, opts?: { error?: string; abort?: boolean; when?: ASTNode }): ZodDateBuilder {
    return this._addCheck("min", { value: value.toISOString() }, opts);
  }

  /** Maximum date constraint. Produces `max` check descriptor with ISO string value. */
  max(value: Date, opts?: { error?: string; abort?: boolean; when?: ASTNode }): ZodDateBuilder {
    return this._addCheck("max", { value: value.toISOString() }, opts);
  }
}

/** Node kinds contributed by the date schema. */
export const dateNodeKinds: string[] = ["zod/date"];

/**
 * Namespace fragment for date schema factories.
 */
export interface ZodDateNamespace {
  /** Create a date schema builder. */
  date(errorOrOpts?: string | { error?: string }): ZodDateBuilder;
}

/** Build the date namespace factory methods. */
export function dateNamespace(
  ctx: PluginContext,
  parseError: (errorOrOpts?: string | { error?: string }) => string | undefined,
): ZodDateNamespace {
  return {
    date(errorOrOpts?: string | { error?: string }): ZodDateBuilder {
      return new ZodDateBuilder(ctx, [], [], parseError(errorOrOpts));
    },
  };
}

/**
 * Apply check descriptors to a Zod date schema.
 * Date values are serialized as ISO strings in the AST and converted back here.
 */
function applyDateChecks(schema: z.ZodDate, checks: CheckDescriptor[]): z.ZodDate {
  let s = schema;
  for (const check of checks) {
    const errOpt = checkErrorOpt(check);
    switch (check.kind) {
      case "min":
        s = s.min(new Date(check.value as string), errOpt);
        break;
      case "max":
        s = s.max(new Date(check.value as string), errOpt);
        break;
      default:
        throw new Error(`Zod interpreter: unknown date check "${check.kind}"`);
    }
  }
  return s;
}

/** Interpreter handlers for date schema nodes. */
export const dateInterpreter: SchemaInterpreterMap = {
  // biome-ignore lint/correctness/useYield: conforms to SchemaInterpreterMap generator signature
  "zod/date": function* (node: ASTNode): Generator<StepEffect, z.ZodType, unknown> {
    const checks = (node.checks as CheckDescriptor[]) ?? [];
    const errorFn = toZodError(node.error as ErrorConfig | undefined);
    const base = errorFn ? z.date({ error: errorFn }) : z.date();
    return applyDateChecks(base, checks);
  },
};
