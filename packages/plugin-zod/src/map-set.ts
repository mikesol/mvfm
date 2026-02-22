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

export class ZodMapBuilder<K, V> extends ZodSchemaBuilder<Map<K, V>> {
  constructor(
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super("zod/map", checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: ErrorConfig;
    extra?: Record<string, unknown>;
  }): ZodMapBuilder<K, V> {
    return new ZodMapBuilder<K, V>(
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }
}

export class ZodSetBuilder<T> extends ZodSchemaBuilder<Set<T>> {
  constructor(
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super("zod/set", checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: ErrorConfig;
    extra?: Record<string, unknown>;
  }): ZodSetBuilder<T> {
    return new ZodSetBuilder<T>(
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }

  min(value: number, opts?: { error?: string }): ZodSetBuilder<T> {
    return this._addCheck("min_size", { value }, opts) as ZodSetBuilder<T>;
  }
  max(value: number, opts?: { error?: string }): ZodSetBuilder<T> {
    return this._addCheck("max_size", { value }, opts) as ZodSetBuilder<T>;
  }
  size(value: number, opts?: { error?: string }): ZodSetBuilder<T> {
    return this._addCheck("size", { value }, opts) as ZodSetBuilder<T>;
  }
}

/** Build the map/set namespace factory methods. */
export function mapSetNamespace(
  parseError: (errorOrOpts?: string | { error?: string }) => string | undefined,
) {
  return {
    map: <K, V>(k: ZodSchemaBuilder<K>, v: ZodSchemaBuilder<V>, e?: string | { error?: string }) =>
      new ZodMapBuilder<K, V>([], [], parseError(e), {
        key: k.__schemaNode,
        value: v.__schemaNode,
      }),
    set: <T>(v: ZodSchemaBuilder<T>, e?: string | { error?: string }) =>
      new ZodSetBuilder<T>([], [], parseError(e), { value: v.__schemaNode }),
  };
}

type SchemaBuildFn = (node: AnyZodSchemaNode) => AsyncGenerator<unknown, z.ZodType, unknown>;
interface ZodMapNode extends ZodSchemaNodeBase {
  kind: "zod/map";
  key: AnyZodSchemaNode;
  value: AnyZodSchemaNode;
}
interface ZodSetNode extends ZodSchemaNodeBase {
  kind: "zod/set";
  value: AnyZodSchemaNode;
}

export function createMapSetInterpreter(buildSchema: SchemaBuildFn): SchemaInterpreterMap {
  return {
    "zod/map": async function* (node: ZodMapNode) {
      const keySchema = yield* buildSchema(node.key);
      const valueSchema = yield* buildSchema(node.value);
      const errorFn = toZodError(node.error as ErrorConfig | undefined);
      const errOpt = errorFn ? { error: errorFn } : {};
      return z.map(keySchema as z.ZodString, valueSchema, errOpt);
    },
    "zod/set": async function* (node: ZodSetNode) {
      const valueSchema = yield* buildSchema(node.value);
      const checks = (node.checks as CheckDescriptor[]) ?? [];
      const errorFn = toZodError(node.error as ErrorConfig | undefined);
      const errOpt = errorFn ? { error: errorFn } : {};
      let s = z.set(valueSchema, errOpt);
      for (const check of checks) {
        const cErr = checkErrorOpt(check);
        switch (check.kind) {
          case "min_size":
            s = s.min(check.value as number, cErr);
            break;
          case "max_size":
            s = s.max(check.value as number, cErr);
            break;
          case "size":
            s = s.size(check.value as number, cErr);
            break;
          default:
            throw new Error(`Zod interpreter: unknown set check "${check.kind}"`);
        }
      }
      return s;
    },
  };
}
