import type { PluginContext, TypedNode } from "@mvfm/core";
import { z } from "zod";
import { ZodSchemaBuilder } from "./base";
import type { SchemaInterpreterMap } from "./interpreter-utils";
import { checkErrorOpt, toZodError } from "./interpreter-utils";
import type { CheckDescriptor, ErrorConfig, RefinementDescriptor } from "./types";

/**
 * Builder for Zod number schemas.
 *
 * Provides number-specific validations (gt, gte, lt, lte, positive, negative,
 * multipleOf) on top of the common base methods.
 */
export class ZodNumberBuilder extends ZodSchemaBuilder<number> {
  constructor(
    ctx: PluginContext,
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
    kind: "zod/number" | "zod/nan" = "zod/number",
  ) {
    super(ctx, kind, checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: string | TypedNode;
    extra?: Record<string, unknown>;
  }): ZodNumberBuilder {
    return new ZodNumberBuilder(
      this._ctx,
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
      this._kind as "zod/number" | "zod/nan",
    );
  }

  // ---- Comparison checks ----

  /** Greater than. Produces `gt` check descriptor. */
  gt(
    value: number,
    opts?: { error?: string; abort?: boolean; when?: TypedNode },
  ): ZodNumberBuilder {
    return this._addCheck("gt", { value }, opts);
  }

  /** Greater than or equal (alias: min). Produces `gte` check descriptor. */
  gte(
    value: number,
    opts?: { error?: string; abort?: boolean; when?: TypedNode },
  ): ZodNumberBuilder {
    return this._addCheck("gte", { value }, opts);
  }

  /** Alias for gte(). */
  min(
    value: number,
    opts?: { error?: string; abort?: boolean; when?: TypedNode },
  ): ZodNumberBuilder {
    return this.gte(value, opts);
  }

  /** Less than. Produces `lt` check descriptor. */
  lt(
    value: number,
    opts?: { error?: string; abort?: boolean; when?: TypedNode },
  ): ZodNumberBuilder {
    return this._addCheck("lt", { value }, opts);
  }

  /** Less than or equal (alias: max). Produces `lte` check descriptor. */
  lte(
    value: number,
    opts?: { error?: string; abort?: boolean; when?: TypedNode },
  ): ZodNumberBuilder {
    return this._addCheck("lte", { value }, opts);
  }

  /** Alias for lte(). */
  max(
    value: number,
    opts?: { error?: string; abort?: boolean; when?: TypedNode },
  ): ZodNumberBuilder {
    return this.lte(value, opts);
  }

  // ---- Sign checks ----

  /** Must be > 0. Produces `positive` check descriptor. */
  positive(opts?: { error?: string; abort?: boolean; when?: TypedNode }): ZodNumberBuilder {
    return this._addCheck("positive", {}, opts);
  }

  /** Must be >= 0. Produces `nonnegative` check descriptor. */
  nonnegative(opts?: { error?: string; abort?: boolean; when?: TypedNode }): ZodNumberBuilder {
    return this._addCheck("nonnegative", {}, opts);
  }

  /** Must be < 0. Produces `negative` check descriptor. */
  negative(opts?: { error?: string; abort?: boolean; when?: TypedNode }): ZodNumberBuilder {
    return this._addCheck("negative", {}, opts);
  }

  /** Must be <= 0. Produces `nonpositive` check descriptor. */
  nonpositive(opts?: { error?: string; abort?: boolean; when?: TypedNode }): ZodNumberBuilder {
    return this._addCheck("nonpositive", {}, opts);
  }

  // ---- Divisibility ----

  /** Must be a multiple of step. Produces `multiple_of` check descriptor. */
  multipleOf(
    step: number,
    opts?: { error?: string; abort?: boolean; when?: TypedNode },
  ): ZodNumberBuilder {
    return this._addCheck("multiple_of", { value: step }, opts);
  }

  /** Alias for multipleOf(). */
  step(
    value: number,
    opts?: { error?: string; abort?: boolean; when?: TypedNode },
  ): ZodNumberBuilder {
    return this.multipleOf(value, opts);
  }

  // ---- Integer/finite/safe checks ----

  /** Must be an integer. Produces `int` check descriptor. */
  int(opts?: { error?: string; abort?: boolean; when?: TypedNode }): ZodNumberBuilder {
    return this._addCheck("int", {}, opts);
  }

  /** Must be finite. Produces `finite` check descriptor. */
  finite(opts?: { error?: string; abort?: boolean; when?: TypedNode }): ZodNumberBuilder {
    return this._addCheck("finite", {}, opts);
  }

  /** Must be a safe integer. Produces `safe` check descriptor. */
  safe(opts?: { error?: string; abort?: boolean; when?: TypedNode }): ZodNumberBuilder {
    return this._addCheck("safe", {}, opts);
  }
}

/** Node kinds contributed by the number schema. */
export const numberNodeKinds: string[] = ["zod/number", "zod/nan"];

/**
 * Namespace fragment for number schema factories.
 */
export interface ZodNumberNamespace {
  /** Create a number schema builder. */
  number(errorOrOpts?: string | { error?: string }): ZodNumberBuilder;
  /** Create an integer schema builder (safe integer range). */
  int(errorOrOpts?: string | { error?: string }): ZodNumberBuilder;
  /** Create an int32 schema builder. */
  int32(errorOrOpts?: string | { error?: string }): ZodNumberBuilder;
  /** Create an int64 schema builder. */
  int64(errorOrOpts?: string | { error?: string }): ZodNumberBuilder;
  /** Create a uint32 schema builder. */
  uint32(errorOrOpts?: string | { error?: string }): ZodNumberBuilder;
  /** Create a uint64 schema builder. */
  uint64(errorOrOpts?: string | { error?: string }): ZodNumberBuilder;
  /** Create a float32 schema builder. */
  float32(errorOrOpts?: string | { error?: string }): ZodNumberBuilder;
  /** Create a float64 schema builder. */
  float64(errorOrOpts?: string | { error?: string }): ZodNumberBuilder;
  /** Create a NaN schema builder. */
  nan(errorOrOpts?: string | { error?: string }): ZodNumberBuilder;
}

/** Build the number namespace factory methods. */
export function numberNamespace(
  ctx: PluginContext,
  parseError: (errorOrOpts?: string | { error?: string }) => string | undefined,
): ZodNumberNamespace {
  return {
    number(errorOrOpts?: string | { error?: string }): ZodNumberBuilder {
      return new ZodNumberBuilder(ctx, [], [], parseError(errorOrOpts));
    },
    int(errorOrOpts?: string | { error?: string }): ZodNumberBuilder {
      return new ZodNumberBuilder(ctx, [], [], parseError(errorOrOpts), { variant: "int" });
    },
    int32(errorOrOpts?: string | { error?: string }): ZodNumberBuilder {
      return new ZodNumberBuilder(ctx, [], [], parseError(errorOrOpts), { variant: "int32" });
    },
    int64(errorOrOpts?: string | { error?: string }): ZodNumberBuilder {
      return new ZodNumberBuilder(ctx, [], [], parseError(errorOrOpts), { variant: "int64" });
    },
    uint32(errorOrOpts?: string | { error?: string }): ZodNumberBuilder {
      return new ZodNumberBuilder(ctx, [], [], parseError(errorOrOpts), { variant: "uint32" });
    },
    uint64(errorOrOpts?: string | { error?: string }): ZodNumberBuilder {
      return new ZodNumberBuilder(ctx, [], [], parseError(errorOrOpts), { variant: "uint64" });
    },
    float32(errorOrOpts?: string | { error?: string }): ZodNumberBuilder {
      return new ZodNumberBuilder(ctx, [], [], parseError(errorOrOpts), { variant: "float32" });
    },
    float64(errorOrOpts?: string | { error?: string }): ZodNumberBuilder {
      return new ZodNumberBuilder(ctx, [], [], parseError(errorOrOpts), { variant: "float64" });
    },
    nan(errorOrOpts?: string | { error?: string }): ZodNumberBuilder {
      return new ZodNumberBuilder(ctx, [], [], parseError(errorOrOpts), {}, "zod/nan");
    },
  };
}

/**
 * Apply check descriptors to a Zod number schema.
 */
function applyNumberChecks(schema: z.ZodNumber, checks: CheckDescriptor[]): z.ZodNumber {
  let s = schema;
  for (const check of checks) {
    const errOpt = checkErrorOpt(check);
    switch (check.kind) {
      case "gt":
        s = s.gt(check.value as number, errOpt);
        break;
      case "gte":
        s = s.gte(check.value as number, errOpt);
        break;
      case "lt":
        s = s.lt(check.value as number, errOpt);
        break;
      case "lte":
        s = s.lte(check.value as number, errOpt);
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
        s = s.multipleOf(check.value as number, errOpt);
        break;
      case "int":
        s = s.int(errOpt);
        break;
      case "finite":
        s = s.finite(errOpt);
        break;
      case "safe":
        s = s.safe(errOpt);
        break;
      default:
        throw new Error(`Zod interpreter: unknown number check "${check.kind}"`);
    }
  }
  return s;
}

/**
 * Build variant-specific number checks from the variant field.
 */
function variantChecks(variant: string | undefined): CheckDescriptor[] {
  switch (variant) {
    case "int":
      return [{ kind: "int" }, { kind: "safe" }];
    case "int32":
      return [
        { kind: "int" },
        { kind: "gte", value: -2147483648 },
        { kind: "lte", value: 2147483647 },
      ];
    case "int64":
      return [{ kind: "int" }, { kind: "safe" }];
    case "uint32":
      return [{ kind: "int" }, { kind: "gte", value: 0 }, { kind: "lte", value: 4294967295 }];
    case "uint64":
      return [{ kind: "int" }, { kind: "gte", value: 0 }, { kind: "safe" }];
    case "float32":
      return [
        { kind: "finite" },
        { kind: "gte", value: -3.4028235e38 },
        { kind: "lte", value: 3.4028235e38 },
      ];
    case "float64":
      return [{ kind: "finite" }];
    default:
      return [];
  }
}

/** Interpreter handlers for number schema nodes. */
export const numberInterpreter: SchemaInterpreterMap = {
  // biome-ignore lint/correctness/useYield: conforms to SchemaInterpreterMap generator signature
  "zod/number": async function* (node: any): AsyncGenerator<TypedNode, z.ZodType, unknown> {
    const variant = node.variant as string | undefined;
    const explicitChecks = (node.checks as CheckDescriptor[]) ?? [];
    const vChecks = variantChecks(variant);
    const allChecks = [...vChecks, ...explicitChecks];
    const errorFn = toZodError(node.error as ErrorConfig | undefined);
    const ctor = node.coerce === true ? z.coerce.number : z.number;
    const base = errorFn ? ctor({ error: errorFn }) : ctor();
    return applyNumberChecks(base as z.ZodNumber, allChecks);
  },
  // biome-ignore lint/correctness/useYield: conforms to SchemaInterpreterMap generator signature
  "zod/nan": async function* (node: any): AsyncGenerator<TypedNode, z.ZodType, unknown> {
    const errorFn = toZodError(node.error as ErrorConfig | undefined);
    return errorFn ? z.nan({ error: errorFn }) : z.nan();
  },
};
