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
 */
export class ZodBigIntBuilder extends ZodSchemaBuilder<bigint> {
  constructor(
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super("zod/bigint", checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: ErrorConfig;
    extra?: Record<string, unknown>;
  }): ZodBigIntBuilder {
    return new ZodBigIntBuilder(
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }

  gt(value: bigint, opts?: { error?: string; abort?: boolean; when?: unknown }): ZodBigIntBuilder {
    return this._addCheck("gt", { value: value.toString() }, opts);
  }

  gte(value: bigint, opts?: { error?: string; abort?: boolean; when?: unknown }): ZodBigIntBuilder {
    return this._addCheck("gte", { value: value.toString() }, opts);
  }

  min(value: bigint, opts?: { error?: string; abort?: boolean; when?: unknown }): ZodBigIntBuilder {
    return this.gte(value, opts);
  }

  lt(value: bigint, opts?: { error?: string; abort?: boolean; when?: unknown }): ZodBigIntBuilder {
    return this._addCheck("lt", { value: value.toString() }, opts);
  }

  lte(value: bigint, opts?: { error?: string; abort?: boolean; when?: unknown }): ZodBigIntBuilder {
    return this._addCheck("lte", { value: value.toString() }, opts);
  }

  max(value: bigint, opts?: { error?: string; abort?: boolean; when?: unknown }): ZodBigIntBuilder {
    return this.lte(value, opts);
  }

  positive(opts?: { error?: string; abort?: boolean; when?: unknown }): ZodBigIntBuilder {
    return this._addCheck("positive", {}, opts);
  }

  nonnegative(opts?: { error?: string; abort?: boolean; when?: unknown }): ZodBigIntBuilder {
    return this._addCheck("nonnegative", {}, opts);
  }

  negative(opts?: { error?: string; abort?: boolean; when?: unknown }): ZodBigIntBuilder {
    return this._addCheck("negative", {}, opts);
  }

  nonpositive(opts?: { error?: string; abort?: boolean; when?: unknown }): ZodBigIntBuilder {
    return this._addCheck("nonpositive", {}, opts);
  }

  multipleOf(
    step: bigint,
    opts?: { error?: string; abort?: boolean; when?: unknown },
  ): ZodBigIntBuilder {
    return this._addCheck("multiple_of", { value: step.toString() }, opts);
  }

  step(
    value: bigint,
    opts?: { error?: string; abort?: boolean; when?: unknown },
  ): ZodBigIntBuilder {
    return this.multipleOf(value, opts);
  }
}

/** Build the bigint namespace factory methods. */
export function bigintNamespace(
  parseError: (errorOrOpts?: string | { error?: string }) => string | undefined,
) {
  return {
    bigint(errorOrOpts?: string | { error?: string }): ZodBigIntBuilder {
      return new ZodBigIntBuilder([], [], parseError(errorOrOpts));
    },
  };
}

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

export const bigintInterpreter: SchemaInterpreterMap = {
  "zod/bigint": async function* (node: ZodBigIntNode): AsyncGenerator<unknown, z.ZodType, unknown> {
    const checks = (node.checks as CheckDescriptor[]) ?? [];
    const errorFn = toZodError(node.error as ErrorConfig | undefined);
    const base = errorFn ? z.bigint({ error: errorFn }) : z.bigint();
    return applyBigIntChecks(base, checks);
  },
};
