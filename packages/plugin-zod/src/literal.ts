import { z } from "zod";
import { ZodSchemaBuilder } from "./base";
import type { SchemaInterpreterMap } from "./interpreter-utils";
import type {
  CheckDescriptor,
  ErrorConfig,
  RefinementDescriptor,
  ZodSchemaNodeBase,
} from "./types";

type LiteralValue = string | number | bigint | boolean;

interface ZodLiteralNode extends ZodSchemaNodeBase {
  kind: "zod/literal";
  value: LiteralValue | [string, ...string[]];
}

export class ZodLiteralBuilder<T extends LiteralValue> extends ZodSchemaBuilder<T> {
  constructor(
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super("zod/literal", checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: ErrorConfig;
    extra?: Record<string, unknown>;
  }): ZodLiteralBuilder<T> {
    return new ZodLiteralBuilder<T>(
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }
}

/** Build the literal namespace factory methods. */
export function literalNamespace() {
  return {
    literal: <T extends LiteralValue>(value: T | T[]) =>
      new ZodLiteralBuilder<T>([], [], undefined, { value }),
  };
}

export const literalInterpreter: SchemaInterpreterMap = {
  "zod/literal": async function* (node: ZodLiteralNode) {
    const value = node.value;
    if (Array.isArray(value)) return z.literal(value as [string, ...string[]]);
    return z.literal(value as string | number | bigint | boolean);
  },
};
