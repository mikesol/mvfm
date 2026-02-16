import type { PluginContext, TypedNode } from "@mvfm/core";
import { z } from "zod";
import { ZodSchemaBuilder } from "./base";
import type { SchemaInterpreterMap } from "./interpreter-utils";
import { toZodError } from "./interpreter-utils";
import type {
  AnyZodSchemaNode,
  CheckDescriptor,
  ErrorConfig,
  RefinementDescriptor,
  ZodSchemaNodeBase,
} from "./types";
import { zodLooseRecord, zodPartialRecord } from "./zod-compat";

/** Record mode: strict (exhaustive), partial (non-exhaustive), or loose (pass-through). */
export type RecordMode = "strict" | "partial" | "loose";

interface ZodRecordNode extends ZodSchemaNodeBase {
  kind: "zod/record";
  key: AnyZodSchemaNode;
  value: AnyZodSchemaNode;
  mode?: RecordMode;
}

/**
 * Builder for Zod record schemas.
 *
 * Stores key and value schemas as AST nodes in extra fields,
 * along with a mode field for strict/partial/loose behavior.
 *
 * @typeParam K - The key type
 * @typeParam V - The value type
 */
export class ZodRecordBuilder<K extends string, V> extends ZodSchemaBuilder<Record<K, V>> {
  constructor(
    ctx: PluginContext,
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super(ctx, "zod/record", checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: string | TypedNode;
    extra?: Record<string, unknown>;
  }): ZodRecordBuilder<K, V> {
    return new ZodRecordBuilder<K, V>(
      this._ctx,
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }
}

/** Node kinds contributed by the record schema. */
export const recordNodeKinds: string[] = ["zod/record"];

/**
 * Namespace fragment for record schema factories.
 */
export interface ZodRecordNamespace {
  /** Create a record schema builder (strict mode — exhaustive key check). */
  record<K extends string, V>(
    keySchema: ZodSchemaBuilder<K>,
    valueSchema: ZodSchemaBuilder<V>,
    errorOrOpts?: string | { error?: string },
  ): ZodRecordBuilder<K, V>;

  /** Create a partial record schema builder (non-exhaustive key check). */
  partialRecord<K extends string, V>(
    keySchema: ZodSchemaBuilder<K>,
    valueSchema: ZodSchemaBuilder<V>,
    errorOrOpts?: string | { error?: string },
  ): ZodRecordBuilder<K, V>;

  /** Create a loose record schema builder (non-matching keys pass through). */
  looseRecord<K extends string, V>(
    keySchema: ZodSchemaBuilder<K>,
    valueSchema: ZodSchemaBuilder<V>,
    errorOrOpts?: string | { error?: string },
  ): ZodRecordBuilder<K, V>;
}

/** Build the record namespace factory methods. */
export function recordNamespace(
  ctx: PluginContext,
  parseError: (errorOrOpts?: string | { error?: string }) => string | undefined,
): ZodRecordNamespace {
  function buildRecord<K extends string, V>(
    keySchema: ZodSchemaBuilder<K>,
    valueSchema: ZodSchemaBuilder<V>,
    mode: string,
    errorOrOpts?: string | { error?: string },
  ): ZodRecordBuilder<K, V> {
    const error = parseError(errorOrOpts);
    return new ZodRecordBuilder<K, V>(ctx, [], [], error, {
      key: keySchema.__schemaNode,
      value: valueSchema.__schemaNode,
      mode,
    });
  }

  return {
    record<K extends string, V>(
      keySchema: ZodSchemaBuilder<K>,
      valueSchema: ZodSchemaBuilder<V>,
      errorOrOpts?: string | { error?: string },
    ): ZodRecordBuilder<K, V> {
      return buildRecord(keySchema, valueSchema, "strict", errorOrOpts);
    },

    partialRecord<K extends string, V>(
      keySchema: ZodSchemaBuilder<K>,
      valueSchema: ZodSchemaBuilder<V>,
      errorOrOpts?: string | { error?: string },
    ): ZodRecordBuilder<K, V> {
      return buildRecord(keySchema, valueSchema, "partial", errorOrOpts);
    },

    looseRecord<K extends string, V>(
      keySchema: ZodSchemaBuilder<K>,
      valueSchema: ZodSchemaBuilder<V>,
      errorOrOpts?: string | { error?: string },
    ): ZodRecordBuilder<K, V> {
      return buildRecord(keySchema, valueSchema, "loose", errorOrOpts);
    },
  };
}

/**
 * Build a Zod schema from a field's AST node by delegating to the
 * interpreter's buildSchemaGen. This is passed in at registration time
 * to avoid circular imports.
 */
type SchemaBuildFn = (node: AnyZodSchemaNode) => AsyncGenerator<TypedNode, z.ZodType, unknown>;

/** Create record interpreter handlers with access to the shared schema builder. */
export function createRecordInterpreter(buildSchema: SchemaBuildFn): SchemaInterpreterMap {
  return {
    "zod/record": async function* (
      node: ZodRecordNode,
    ): AsyncGenerator<TypedNode, z.ZodType, unknown> {
      const keySchema = yield* buildSchema(node.key);
      const valueSchema = yield* buildSchema(node.value);
      const mode = node.mode ?? "strict";
      const errorFn = toZodError(node.error as ErrorConfig | undefined);
      const errOpt = errorFn ? { error: errorFn } : {};
      switch (mode) {
        case "partial":
          return zodPartialRecord(keySchema, valueSchema, errOpt);
        case "loose":
          return zodLooseRecord(keySchema, valueSchema, errOpt);
        default:
          return z.record(keySchema as z.ZodString, valueSchema, errOpt);
      }
    },
  };
}
