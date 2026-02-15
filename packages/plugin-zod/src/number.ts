import type { ASTNode, PluginContext } from "@mvfm/core";
import { ZodSchemaBuilder } from "./base";
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
    error?: string | ASTNode;
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
  gt(value: number, opts?: { error?: string; abort?: boolean; when?: ASTNode }): ZodNumberBuilder {
    return this._addCheck("gt", { value }, opts);
  }

  /** Greater than or equal (alias: min). Produces `gte` check descriptor. */
  gte(value: number, opts?: { error?: string; abort?: boolean; when?: ASTNode }): ZodNumberBuilder {
    return this._addCheck("gte", { value }, opts);
  }

  /** Alias for gte(). */
  min(value: number, opts?: { error?: string; abort?: boolean; when?: ASTNode }): ZodNumberBuilder {
    return this.gte(value, opts);
  }

  /** Less than. Produces `lt` check descriptor. */
  lt(value: number, opts?: { error?: string; abort?: boolean; when?: ASTNode }): ZodNumberBuilder {
    return this._addCheck("lt", { value }, opts);
  }

  /** Less than or equal (alias: max). Produces `lte` check descriptor. */
  lte(value: number, opts?: { error?: string; abort?: boolean; when?: ASTNode }): ZodNumberBuilder {
    return this._addCheck("lte", { value }, opts);
  }

  /** Alias for lte(). */
  max(value: number, opts?: { error?: string; abort?: boolean; when?: ASTNode }): ZodNumberBuilder {
    return this.lte(value, opts);
  }

  // ---- Sign checks ----

  /** Must be > 0. Produces `positive` check descriptor. */
  positive(opts?: { error?: string; abort?: boolean; when?: ASTNode }): ZodNumberBuilder {
    return this._addCheck("positive", {}, opts);
  }

  /** Must be >= 0. Produces `nonnegative` check descriptor. */
  nonnegative(opts?: { error?: string; abort?: boolean; when?: ASTNode }): ZodNumberBuilder {
    return this._addCheck("nonnegative", {}, opts);
  }

  /** Must be < 0. Produces `negative` check descriptor. */
  negative(opts?: { error?: string; abort?: boolean; when?: ASTNode }): ZodNumberBuilder {
    return this._addCheck("negative", {}, opts);
  }

  /** Must be <= 0. Produces `nonpositive` check descriptor. */
  nonpositive(opts?: { error?: string; abort?: boolean; when?: ASTNode }): ZodNumberBuilder {
    return this._addCheck("nonpositive", {}, opts);
  }

  // ---- Divisibility ----

  /** Must be a multiple of step. Produces `multiple_of` check descriptor. */
  multipleOf(
    step: number,
    opts?: { error?: string; abort?: boolean; when?: ASTNode },
  ): ZodNumberBuilder {
    return this._addCheck("multiple_of", { value: step }, opts);
  }

  /** Alias for multipleOf(). */
  step(
    value: number,
    opts?: { error?: string; abort?: boolean; when?: ASTNode },
  ): ZodNumberBuilder {
    return this.multipleOf(value, opts);
  }

  // ---- Integer/finite/safe checks ----

  /** Must be an integer. Produces `int` check descriptor. */
  int(opts?: { error?: string; abort?: boolean; when?: ASTNode }): ZodNumberBuilder {
    return this._addCheck("int", {}, opts);
  }

  /** Must be finite. Produces `finite` check descriptor. */
  finite(opts?: { error?: string; abort?: boolean; when?: ASTNode }): ZodNumberBuilder {
    return this._addCheck("finite", {}, opts);
  }

  /** Must be a safe integer. Produces `safe` check descriptor. */
  safe(opts?: { error?: string; abort?: boolean; when?: ASTNode }): ZodNumberBuilder {
    return this._addCheck("safe", {}, opts);
  }
}
