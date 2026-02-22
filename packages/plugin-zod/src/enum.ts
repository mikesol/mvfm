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

interface ZodEnumNode extends ZodSchemaNodeBase {
  kind: "zod/enum";
  values: [string, ...string[]];
}

interface ZodNativeEnumNode extends ZodSchemaNodeBase {
  kind: "zod/native_enum";
  entries: Record<string, string | number>;
}

export class ZodEnumBuilder<T extends string> extends ZodSchemaBuilder<T> {
  constructor(
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super("zod/enum", checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: ErrorConfig;
    extra?: Record<string, unknown>;
  }): ZodEnumBuilder<T> {
    return new ZodEnumBuilder<T>(
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }

  extract<U extends T>(values: U[]): ZodEnumBuilder<U> {
    return new ZodEnumBuilder<U>([], [], this._error, { ...this._extra, values });
  }

  exclude<U extends T>(values: U[]): ZodEnumBuilder<Exclude<T, U>> {
    const current = (this._extra.values as T[]) ?? [];
    const remaining = current.filter((v) => !values.includes(v as U));
    return new ZodEnumBuilder<Exclude<T, U>>([], [], this._error, {
      ...this._extra,
      values: remaining,
    });
  }
}

export class ZodNativeEnumBuilder<T> extends ZodSchemaBuilder<T> {
  constructor(
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super("zod/native_enum", checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: ErrorConfig;
    extra?: Record<string, unknown>;
  }): ZodNativeEnumBuilder<T> {
    return new ZodNativeEnumBuilder<T>(
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }
}

/** Build the enum namespace factory methods. */
export function enumNamespace(
  parseError: (errorOrOpts?: string | { error?: string }) => string | undefined,
) {
  return {
    enum: <T extends string>(values: T[], e?: string | { error?: string }) =>
      new ZodEnumBuilder<T>([], [], parseError(e), { values }),
    nativeEnum: <T extends Record<string, string | number>>(
      enumObj: T,
      e?: string | { error?: string },
    ) => new ZodNativeEnumBuilder<T[keyof T]>([], [], parseError(e), { entries: enumObj }),
  };
}

export const enumInterpreter: SchemaInterpreterMap = {
  "zod/enum": async function* (node: ZodEnumNode) {
    const values = node.values as [string, ...string[]];
    const errorFn = toZodError(node.error as ErrorConfig | undefined);
    const errOpt = errorFn ? { error: errorFn } : {};
    return z.enum(values, errOpt);
  },
  "zod/native_enum": async function* (node: ZodNativeEnumNode) {
    const entries = node.entries as Record<string, string | number>;
    const errorFn = toZodError(node.error as ErrorConfig | undefined);
    const errOpt = errorFn ? { error: errorFn } : {};
    return z.nativeEnum(entries, errOpt);
  },
};
