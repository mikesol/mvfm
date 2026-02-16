import type { PluginContext, TypedNode } from "@mvfm/core";
import { z } from "zod";
import { ZodSchemaBuilder } from "./base";
import type { SchemaInterpreterMap } from "./interpreter-utils";
import { checkErrorOpt, toZodError } from "./interpreter-utils";
import type {
  CheckDescriptor,
  ErrorConfig,
  RefinementDescriptor,
  ZodSchemaNodeBase,
} from "./types";

interface ZodBigIntNode extends ZodSchemaNodeBase {
  kind: "zod/bigint";
}

/**
 * Builder for Zod bigint schemas.
 *
 * Provides bigint-specific validations (gt, gte, lt, lte, positive, negative,
 * multipleOf) on top of the common base methods.
 */
export class ZodBigIntBuilder extends ZodSchemaBuilder<bigint> {
  constructor(
    ctx: PluginContext,
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super(ctx, "zod/bigint", checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: string | TypedNode;
    extra?: Record<string, unknown>;
  }): ZodBigIntBuilder {
    return new ZodBigIntBuilder(
      this._ctx,
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }

  // ---- Comparison checks ----

  /** Greater than. Produces `gt` check descriptor. */
  gt(
    value: bigint,
    opts?: { error?: string; abort?: boolean; when?: TypedNode },
  ): ZodBigIntBuilder {
    return this._addCheck("gt", { value: value.toString() }, opts);
  }

  /** Greater than or equal (alias: min). Produces `gte` check descriptor. */
  gte(
    value: bigint,
    opts?: { error?: string; abort?: boolean; when?: TypedNode },
  ): ZodBigIntBuilder {
    return this._addCheck("gte", { value: value.toString() }, opts);
  }

  /** Alias for gte(). */
  min(
    value: bigint,
    opts?: { error?: string; abort?: boolean; when?: TypedNode },
  ): ZodBigIntBuilder {
    return this.gte(value, opts);
  }

  /** Less than. Produces `lt` check descriptor. */
  lt(
    value: bigint,
    opts?: { error?: string; abort?: boolean; when?: TypedNode },
  ): ZodBigIntBuilder {
    return this._addCheck("lt", { value: value.toString() }, opts);
  }

  /** Less than or equal (alias: max). Produces `lte` check descriptor. */
  lte(
    value: bigint,
    opts?: { error?: string; abort?: boolean; when?: TypedNode },
  ): ZodBigIntBuilder {
    return this._addCheck("lte", { value: value.toString() }, opts);
  }

  /** Alias for lte(). */
  max(
    value: bigint,
    opts?: { error?: string; abort?: boolean; when?: TypedNode },
  ): ZodBigIntBuilder {
    return this.lte(value, opts);
  }

  // ---- Sign checks ----

  /** Must be > 0n. Produces `positive` check descriptor. */
  positive(opts?: { error?: string; abort?: boolean; when?: TypedNode }): ZodBigIntBuilder {
    return this._addCheck("positive", {}, opts);
  }

  /** Must be >= 0n. Produces `nonnegative` check descriptor. */
  nonnegative(opts?: { error?: string; abort?: boolean; when?: TypedNode }): ZodBigIntBuilder {
    return this._addCheck("nonnegative", {}, opts);
  }

  /** Must be < 0n. Produces `negative` check descriptor. */
  negative(opts?: { error?: string; abort?: boolean; when?: TypedNode }): ZodBigIntBuilder {
    return this._addCheck("negative", {}, opts);
  }

  /** Must be <= 0n. Produces `nonpositive` check descriptor. */
  nonpositive(opts?: { error?: string; abort?: boolean; when?: TypedNode }): ZodBigIntBuilder {
    return this._addCheck("nonpositive", {}, opts);
  }

  // ---- Divisibility ----

  /** Must be a multiple of step. Produces `multiple_of` check descriptor. */
  multipleOf(
    step: bigint,
    opts?: { error?: string; abort?: boolean; when?: TypedNode },
  ): ZodBigIntBuilder {
    return this._addCheck("multiple_of", { value: step.toString() }, opts);
  }

  /** Alias for multipleOf(). */
  step(
    value: bigint,
    opts?: { error?: string; abort?: boolean; when?: TypedNode },
  ): ZodBigIntBuilder {
    return this.multipleOf(value, opts);
  }
}

/** Node kinds contributed by the bigint schema. */
export const bigintNodeKinds: string[] = ["zod/bigint"];

/**
 * Namespace fragment for bigint schema factories.
 */
export interface ZodBigIntNamespace {
  /** Create a bigint schema builder. */
  bigint(errorOrOpts?: string | { error?: string }): ZodBigIntBuilder;
}

/** Build the bigint namespace factory methods. */
export function bigintNamespace(
  ctx: PluginContext,
  parseError: (errorOrOpts?: string | { error?: string }) => string | undefined,
): ZodBigIntNamespace {
  return {
    bigint(errorOrOpts?: string | { error?: string }): ZodBigIntBuilder {
      return new ZodBigIntBuilder(ctx, [], [], parseError(errorOrOpts));
    },
  };
}

/**
 * Apply check descriptors to a Zod bigint schema.
 * BigInt values are serialized as strings in the AST and converted back here.
 */
function applyBigIntChecks(schema: z.ZodBigInt, checks: CheckDescriptor[]): z.ZodBigInt {
  let s = schema;
  for (const check of checks) {
    const errOpt = checkErrorOpt(check);
    switch (check.kind) {
      case "gt":
        s = s.gt(BigInt(check.value as string), errOpt);
        break;
      case "gte":
        s = s.gte(BigInt(check.value as string), errOpt);
        break;
      case "lt":
        s = s.lt(BigInt(check.value as string), errOpt);
        break;
      case "lte":
        s = s.lte(BigInt(check.value as string), errOpt);
        break;
      case "positive":
        s = s.positive(errOpt);
        break;
      case "nonnegative":
        s = s.nonnegative(errOpt);
        break;
      case "negative":
        s = s.negative(errOpt);
        break;
      case "nonpositive":
        s = s.nonpositive(errOpt);
        break;
      case "multiple_of":
        s = s.multipleOf(BigInt(check.value as string), errOpt);
        break;
      default:
        throw new Error(`Zod interpreter: unknown bigint check "${check.kind}"`);
    }
  }
  return s;
}

/** Interpreter handlers for bigint schema nodes. */
export const bigintInterpreter: SchemaInterpreterMap = {
  // biome-ignore lint/correctness/useYield: conforms to SchemaInterpreterMap generator signature
  "zod/bigint": async function* (
    node: ZodBigIntNode,
  ): AsyncGenerator<TypedNode, z.ZodType, unknown> {
    const checks = (node.checks as CheckDescriptor[]) ?? [];
    const errorFn = toZodError(node.error as ErrorConfig | undefined);
    const base = errorFn ? z.bigint({ error: errorFn }) : z.bigint();
    return applyBigIntChecks(base, checks);
  },
};
