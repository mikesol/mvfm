import { ZodSchemaBuilder } from "./base";
import type { CheckDescriptor, ErrorConfig, RefinementDescriptor } from "./types";

/**
 * Builder for Zod string schemas.
 *
 * Provides string-specific validations (min, max, regex, etc.) and
 * transforms (trim, toLowerCase, toUpperCase) on top of the common
 * base methods (parse, safeParse, refine, optional, etc.).
 */
export class ZodStringBuilder extends ZodSchemaBuilder<string> {
  constructor(
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super("zod/string", checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: ErrorConfig;
    extra?: Record<string, unknown>;
  }): ZodStringBuilder {
    return new ZodStringBuilder(
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }

  min(
    length: number,
    opts?: { error?: string; abort?: boolean; when?: unknown },
  ): ZodStringBuilder {
    return this._addCheck("min_length", { value: length }, opts);
  }

  max(
    length: number,
    opts?: { error?: string; abort?: boolean; when?: unknown },
  ): ZodStringBuilder {
    return this._addCheck("max_length", { value: length }, opts);
  }

  length(
    len: number,
    opts?: { error?: string; abort?: boolean; when?: unknown },
  ): ZodStringBuilder {
    return this._addCheck("length", { value: len }, opts);
  }

  regex(
    pattern: RegExp,
    opts?: { error?: string; abort?: boolean; when?: unknown },
  ): ZodStringBuilder {
    return this._addCheck("regex", { pattern: pattern.source, flags: pattern.flags }, opts);
  }

  startsWith(
    prefix: string,
    opts?: { error?: string; abort?: boolean; when?: unknown },
  ): ZodStringBuilder {
    return this._addCheck("starts_with", { value: prefix }, opts);
  }

  endsWith(
    suffix: string,
    opts?: { error?: string; abort?: boolean; when?: unknown },
  ): ZodStringBuilder {
    return this._addCheck("ends_with", { value: suffix }, opts);
  }

  includes(
    substring: string,
    opts?: { error?: string; abort?: boolean; when?: unknown },
  ): ZodStringBuilder {
    return this._addCheck("includes", { value: substring }, opts);
  }

  uppercase(opts?: { error?: string; abort?: boolean; when?: unknown }): ZodStringBuilder {
    return this._addCheck("uppercase", {}, opts);
  }

  lowercase(opts?: { error?: string; abort?: boolean; when?: unknown }): ZodStringBuilder {
    return this._addCheck("lowercase", {}, opts);
  }

  trim(opts?: { error?: string; abort?: boolean; when?: unknown }): ZodStringBuilder {
    return this._addCheck("trim", {}, opts);
  }

  toLowerCase(opts?: { error?: string; abort?: boolean; when?: unknown }): ZodStringBuilder {
    return this._addCheck("to_lower_case", {}, opts);
  }

  toUpperCase(opts?: { error?: string; abort?: boolean; when?: unknown }): ZodStringBuilder {
    return this._addCheck("to_upper_case", {}, opts);
  }

  normalize(
    form?: "NFC" | "NFD" | "NFKC" | "NFKD",
    opts?: { error?: string; abort?: boolean; when?: unknown },
  ): ZodStringBuilder {
    return this._addCheck("normalize", { form: form ?? "NFC" }, opts);
  }
}
