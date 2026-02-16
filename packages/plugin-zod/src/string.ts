import type { PluginContext, TypedNode } from "@mvfm/core";
import { z } from "zod";
import { ZodSchemaBuilder } from "./base";
import type { SchemaInterpreterMap } from "./interpreter-utils";
import { checkErrorOpt, toZodError } from "./interpreter-utils";
import { buildStringFormat } from "./string-formats";
import type {
  CheckDescriptor,
  ErrorConfig,
  RefinementDescriptor,
  ZodSchemaNodeBase,
} from "./types";

interface ZodStringNode extends ZodSchemaNodeBase {
  kind: "zod/string";
  coerce?: boolean;
  format?: Record<string, unknown>;
}

/**
 * Builder for Zod string schemas.
 *
 * Provides string-specific validations (min, max, regex, etc.) and
 * transforms (trim, toLowerCase, toUpperCase) on top of the common
 * base methods (parse, safeParse, refine, optional, etc.).
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
    error?: string | TypedNode;
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

  // ---- Length validations ----

  /** Minimum length. Produces `min_length` check descriptor. */
  min(
    length: number,
    opts?: { error?: string; abort?: boolean; when?: TypedNode },
  ): ZodStringBuilder {
    return this._addCheck("min_length", { value: length }, opts);
  }

  /** Maximum length. Produces `max_length` check descriptor. */
  max(
    length: number,
    opts?: { error?: string; abort?: boolean; when?: TypedNode },
  ): ZodStringBuilder {
    return this._addCheck("max_length", { value: length }, opts);
  }

  /** Exact length. Produces `length` check descriptor. */
  length(
    len: number,
    opts?: { error?: string; abort?: boolean; when?: TypedNode },
  ): ZodStringBuilder {
    return this._addCheck("length", { value: len }, opts);
  }

  // ---- Pattern matching ----

  /** Regex match. Produces `regex` check descriptor. */
  regex(
    pattern: RegExp,
    opts?: { error?: string; abort?: boolean; when?: TypedNode },
  ): ZodStringBuilder {
    return this._addCheck("regex", { pattern: pattern.source, flags: pattern.flags }, opts);
  }

  // ---- Substring checks ----

  /** Must start with prefix. Produces `starts_with` check descriptor. */
  startsWith(
    prefix: string,
    opts?: { error?: string; abort?: boolean; when?: TypedNode },
  ): ZodStringBuilder {
    return this._addCheck("starts_with", { value: prefix }, opts);
  }

  /** Must end with suffix. Produces `ends_with` check descriptor. */
  endsWith(
    suffix: string,
    opts?: { error?: string; abort?: boolean; when?: TypedNode },
  ): ZodStringBuilder {
    return this._addCheck("ends_with", { value: suffix }, opts);
  }

  /** Must contain substring. Produces `includes` check descriptor. */
  includes(
    substring: string,
    opts?: { error?: string; abort?: boolean; when?: TypedNode },
  ): ZodStringBuilder {
    return this._addCheck("includes", { value: substring }, opts);
  }

  // ---- Case checks ----

  /** Must be all uppercase. Produces `uppercase` check descriptor. */
  uppercase(opts?: { error?: string; abort?: boolean; when?: TypedNode }): ZodStringBuilder {
    return this._addCheck("uppercase", {}, opts);
  }

  /** Must be all lowercase. Produces `lowercase` check descriptor. */
  lowercase(opts?: { error?: string; abort?: boolean; when?: TypedNode }): ZodStringBuilder {
    return this._addCheck("lowercase", {}, opts);
  }

  // ---- Transforms ----

  /** Trim whitespace. Produces `trim` check descriptor. */
  trim(opts?: { error?: string; abort?: boolean; when?: TypedNode }): ZodStringBuilder {
    return this._addCheck("trim", {}, opts);
  }

  /** Convert to lowercase. Produces `to_lower_case` check descriptor. */
  toLowerCase(opts?: { error?: string; abort?: boolean; when?: TypedNode }): ZodStringBuilder {
    return this._addCheck("to_lower_case", {}, opts);
  }

  /** Convert to uppercase. Produces `to_upper_case` check descriptor. */
  toUpperCase(opts?: { error?: string; abort?: boolean; when?: TypedNode }): ZodStringBuilder {
    return this._addCheck("to_upper_case", {}, opts);
  }

  /** Unicode normalize. Produces `normalize` check descriptor. */
  normalize(
    form?: "NFC" | "NFD" | "NFKC" | "NFKD",
    opts?: { error?: string; abort?: boolean; when?: TypedNode },
  ): ZodStringBuilder {
    return this._addCheck("normalize", { form: form ?? "NFC" }, opts);
  }
}

/** Node kinds contributed by the string schema. */
export const stringNodeKinds: string[] = ["zod/string"];

/**
 * Namespace fragment for string schema factories.
 */
export interface ZodStringNamespace {
  /** Create a string schema builder. */
  string(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
}

/** Build the string namespace factory methods. */
export function stringNamespace(
  ctx: PluginContext,
  parseError: (errorOrOpts?: string | { error?: string }) => string | undefined,
): ZodStringNamespace {
  return {
    string(errorOrOpts?: string | { error?: string }): ZodStringBuilder {
      return new ZodStringBuilder(ctx, [], [], parseError(errorOrOpts));
    },
  };
}

/**
 * Apply check descriptors to a Zod string schema.
 * Each check kind maps to the corresponding Zod method.
 * Validations produce z.ZodString; transforms produce z.ZodPipe.
 */
function applyStringChecks(schema: z.ZodString, checks: CheckDescriptor[]): z.ZodType {
  let s: z.ZodType = schema;
  for (const check of checks) {
    const errOpt = checkErrorOpt(check);
    switch (check.kind) {
      case "min_length":
        s = (s as z.ZodString).min(check.value as number, errOpt);
        break;
      case "max_length":
        s = (s as z.ZodString).max(check.value as number, errOpt);
        break;
      case "length":
        s = (s as z.ZodString).length(check.value as number, errOpt);
        break;
      case "regex":
        s = (s as z.ZodString).regex(
          new RegExp(check.pattern as string, (check.flags as string) ?? ""),
          errOpt,
        );
        break;
      case "starts_with":
        s = (s as z.ZodString).startsWith(check.value as string, errOpt);
        break;
      case "ends_with":
        s = (s as z.ZodString).endsWith(check.value as string, errOpt);
        break;
      case "includes":
        s = (s as z.ZodString).includes(check.value as string, errOpt);
        break;
      case "uppercase":
        s = (s as z.ZodString).regex(/^[^a-z]*$/, errOpt);
        break;
      case "lowercase":
        s = (s as z.ZodString).regex(/^[^A-Z]*$/, errOpt);
        break;
      case "trim":
        s = (s as z.ZodString).trim();
        break;
      case "to_lower_case":
        s = (s as z.ZodString).toLowerCase();
        break;
      case "to_upper_case":
        s = (s as z.ZodString).toUpperCase();
        break;
      case "normalize":
        s = (s as z.ZodString).normalize(check.form as string);
        break;
      default:
        throw new Error(`Zod interpreter: unknown string check "${check.kind}"`);
    }
  }
  return s;
}

/** Interpreter handlers for string schema nodes. */
export const stringInterpreter: SchemaInterpreterMap = {
  "zod/string": async function* (
    node: ZodStringNode,
  ): AsyncGenerator<TypedNode, z.ZodType, unknown> {
    const checks = (node.checks as CheckDescriptor[]) ?? [];
    const errorFn = toZodError(node.error as ErrorConfig | undefined);
    const format = node.format as Record<string, unknown> | undefined;
    const base = format
      ? buildStringFormat(format, errorFn)
      : (() => {
          const ctor = node.coerce === true ? z.coerce.string : z.string;
          return errorFn ? ctor({ error: errorFn }) : ctor();
        })();
    return applyStringChecks(base as z.ZodString, checks);
  },
};
