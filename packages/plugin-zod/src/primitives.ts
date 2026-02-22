import { z } from "zod";
import { ZodSchemaBuilder } from "./base";
import type { SchemaInterpreterMap } from "./interpreter-utils";
import { toZodError } from "./interpreter-utils";
import type {
  CheckDescriptor,
  ErrorConfig,
  RefinementDescriptor,
  ZodSchemaNodeBase,
} from "./types";

/**
 * Builder for simple Zod primitive schemas with no type-specific methods.
 */
export class ZodPrimitiveBuilder<T> extends ZodSchemaBuilder<T> {
  constructor(
    kind: string,
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super(kind, checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: ErrorConfig;
    extra?: Record<string, unknown>;
  }): ZodPrimitiveBuilder<T> {
    return new ZodPrimitiveBuilder<T>(
      this._kind,
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }
}

/** Build the primitives namespace factory methods. */
export function primitivesNamespace(
  parseError: (errorOrOpts?: string | { error?: string }) => string | undefined,
) {
  return {
    boolean: (e?: string | { error?: string }) =>
      new ZodPrimitiveBuilder<boolean>("zod/boolean", [], [], parseError(e)),
    null: (e?: string | { error?: string }) =>
      new ZodPrimitiveBuilder<null>("zod/null", [], [], parseError(e)),
    undefined: (e?: string | { error?: string }) =>
      new ZodPrimitiveBuilder<undefined>("zod/undefined", [], [], parseError(e)),
    void: (e?: string | { error?: string }) =>
      new ZodPrimitiveBuilder<void>("zod/void", [], [], parseError(e)),
    symbol: (e?: string | { error?: string }) =>
      new ZodPrimitiveBuilder<symbol>("zod/symbol", [], [], parseError(e)),
  };
}

export const primitivesInterpreter: SchemaInterpreterMap = {
  "zod/boolean": async function* (node: ZodSchemaNodeBase) {
    const errorFn = toZodError(node.error as ErrorConfig | undefined);
    return errorFn ? z.boolean({ error: errorFn }) : z.boolean();
  },
  "zod/null": async function* () {
    return z.null();
  },
  "zod/undefined": async function* () {
    return z.undefined();
  },
  "zod/void": async function* () {
    return z.void();
  },
  "zod/symbol": async function* () {
    return z.symbol();
  },
};
