import type { PluginContext } from "@mvfm/core";
import { ZodNumberBuilder } from "./number";
import { ZodStringBuilder } from "./string";

/**
 * Coercion namespace within the Zod plugin.
 *
 * Each method returns the same builder as the base type, but with `coerce: true`
 * in the extra field so the interpreter uses `z.coerce.*` constructors.
 * This converts input via `String(input)`, `Number(input)`, etc. before validation.
 */
export interface ZodCoerceNamespace {
  /** Coerce input to string via `String(input)`. */
  string(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
  /** Coerce input to number via `Number(input)`. */
  number(errorOrOpts?: string | { error?: string }): ZodNumberBuilder;
  // Future coerce types (boolean, bigint, date) added by their respective issues
}

/** Node kinds contributed by coercion — none; coercion reuses existing schema kinds. */
export const coerceNodeKinds: string[] = [];

/**
 * Build the coercion namespace factory methods.
 *
 * Each factory delegates to the underlying schema builder, passing
 * `{ coerce: true }` as the extra field. The interpreter checks this
 * flag to select `z.coerce.*` constructors.
 */
export function coerceNamespace(
  ctx: PluginContext,
  parseError: (errorOrOpts?: string | { error?: string }) => string | undefined,
): { coerce: ZodCoerceNamespace } {
  return {
    coerce: {
      string(errorOrOpts?: string | { error?: string }): ZodStringBuilder {
        return new ZodStringBuilder(ctx, [], [], parseError(errorOrOpts), { coerce: true });
      },
      number(errorOrOpts?: string | { error?: string }): ZodNumberBuilder {
        return new ZodNumberBuilder(ctx, [], [], parseError(errorOrOpts), { coerce: true });
      },
    },
  };
}
