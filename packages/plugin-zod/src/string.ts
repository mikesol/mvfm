import type { ASTNode, PluginContext } from "@mvfm/core";
import { ZodSchemaBuilder } from "./base";
import type { CheckDescriptor, ErrorConfig, RefinementDescriptor } from "./types";

/**
 * Builder for Zod string schemas.
 *
 * Provides string-specific validations (min, max, regex, etc.) on top
 * of the common base methods (parse, safeParse, refine, optional, etc.).
 *
 * @stub Most methods will be implemented by #100. This file establishes
 * the subclass pattern for other schema types to follow.
 */
export class ZodStringBuilder extends ZodSchemaBuilder<string> {
  constructor(
    ctx: PluginContext,
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super(ctx, "zod/string", checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: string | ASTNode;
    extra?: Record<string, unknown>;
  }): ZodStringBuilder {
    return new ZodStringBuilder(
      this._ctx,
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }

  // ---- String-specific methods (implemented by #100) ----
  // Stubs to prove the subclass pattern compiles.

  /** @stub Implemented by #100 */
  min(
    length: number,
    opts?: { error?: string; abort?: boolean; when?: ASTNode },
  ): ZodStringBuilder {
    return this._addCheck("min_length", { value: length }, opts);
  }

  /** @stub Implemented by #100 */
  max(
    length: number,
    opts?: { error?: string; abort?: boolean; when?: ASTNode },
  ): ZodStringBuilder {
    return this._addCheck("max_length", { value: length }, opts);
  }
}
