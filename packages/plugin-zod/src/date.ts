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

interface ZodDateNode extends ZodSchemaNodeBase {
  kind: "zod/date";
}

/**
 * Builder for Zod date schemas.
 */
export class ZodDateBuilder extends ZodSchemaBuilder<Date> {
  constructor(
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super("zod/date", checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: ErrorConfig;
    extra?: Record<string, unknown>;
  }): ZodDateBuilder {
    return new ZodDateBuilder(
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }

  min(value: Date, opts?: { error?: string; abort?: boolean; when?: unknown }): ZodDateBuilder {
    return this._addCheck("min", { value: value.toISOString() }, opts);
  }

  max(value: Date, opts?: { error?: string; abort?: boolean; when?: unknown }): ZodDateBuilder {
    return this._addCheck("max", { value: value.toISOString() }, opts);
  }
}

/** Build the date namespace factory methods. */
export function dateNamespace(
  parseError: (errorOrOpts?: string | { error?: string }) => string | undefined,
) {
  return {
    date(errorOrOpts?: string | { error?: string }): ZodDateBuilder {
      return new ZodDateBuilder([], [], parseError(errorOrOpts));
    },
  };
}

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

export const dateInterpreter: SchemaInterpreterMap = {
  "zod/date": async function* (node: ZodDateNode): AsyncGenerator<unknown, z.ZodType, unknown> {
    const checks = (node.checks as CheckDescriptor[]) ?? [];
    const errorFn = toZodError(node.error as ErrorConfig | undefined);
    const base = errorFn ? z.date({ error: errorFn }) : z.date();
    return applyDateChecks(base, checks);
  },
};
