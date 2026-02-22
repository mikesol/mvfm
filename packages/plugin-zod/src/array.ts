import { z } from "zod";
import { ZodSchemaBuilder } from "./base";
import type { SchemaInterpreterMap } from "./interpreter-utils";
import { checkErrorOpt, toZodError } from "./interpreter-utils";
import type {
  AnyZodSchemaNode,
  CheckDescriptor,
  ErrorConfig,
  RefinementDescriptor,
  ZodSchemaNodeBase,
} from "./types";

interface ZodArrayNode extends ZodSchemaNodeBase {
  kind: "zod/array";
  element: AnyZodSchemaNode;
}

/**
 * Builder for Zod array schemas.
 */
export class ZodArrayBuilder<T> extends ZodSchemaBuilder<T[]> {
  constructor(
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super("zod/array", checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: ErrorConfig;
    extra?: Record<string, unknown>;
  }): ZodArrayBuilder<T> {
    return new ZodArrayBuilder<T>(
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }

  min(
    value: number,
    opts?: { error?: string; abort?: boolean; when?: unknown },
  ): ZodArrayBuilder<T> {
    return this._addCheck("min_length", { value }, opts) as ZodArrayBuilder<T>;
  }

  max(
    value: number,
    opts?: { error?: string; abort?: boolean; when?: unknown },
  ): ZodArrayBuilder<T> {
    return this._addCheck("max_length", { value }, opts) as ZodArrayBuilder<T>;
  }

  length(
    value: number,
    opts?: { error?: string; abort?: boolean; when?: unknown },
  ): ZodArrayBuilder<T> {
    return this._addCheck("length", { value }, opts) as ZodArrayBuilder<T>;
  }
}

/** Build the array namespace factory methods. */
export function arrayNamespace(
  parseError: (errorOrOpts?: string | { error?: string }) => string | undefined,
) {
  return {
    array<T>(
      element: ZodSchemaBuilder<T>,
      errorOrOpts?: string | { error?: string },
    ): ZodArrayBuilder<T> {
      const error = parseError(errorOrOpts);
      return new ZodArrayBuilder<T>([], [], error, { element: element.__schemaNode });
    },
  };
}

function applyArrayChecks(schema: z.ZodArray, checks: CheckDescriptor[]): z.ZodArray {
  let s = schema;
  for (const check of checks) {
    const errOpt = checkErrorOpt(check);
    switch (check.kind) {
      case "min_length":
        s = s.min(check.value as number, errOpt);
        break;
      case "max_length":
        s = s.max(check.value as number, errOpt);
        break;
      case "length":
        s = s.length(check.value as number, errOpt);
        break;
      default:
        throw new Error(`Zod interpreter: unknown array check "${check.kind}"`);
    }
  }
  return s;
}

type SchemaBuildFn = (node: AnyZodSchemaNode) => AsyncGenerator<unknown, z.ZodType, unknown>;

export function createArrayInterpreter(buildSchema: SchemaBuildFn): SchemaInterpreterMap {
  return {
    "zod/array": async function* (node: ZodArrayNode): AsyncGenerator<unknown, z.ZodType, unknown> {
      const elementSchema = yield* buildSchema(node.element);
      const checks = (node.checks as CheckDescriptor[]) ?? [];
      const errorFn = toZodError(node.error as ErrorConfig | undefined);
      const errOpt = errorFn ? { error: errorFn } : {};
      const arr = z.array(elementSchema, errOpt);
      return applyArrayChecks(arr, checks);
    },
  };
}
