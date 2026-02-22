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

export type RecordMode = "strict" | "partial" | "loose";

export class ZodRecordBuilder<K extends string, V> extends ZodSchemaBuilder<Record<K, V>> {
  constructor(
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super("zod/record", checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: ErrorConfig;
    extra?: Record<string, unknown>;
  }): ZodRecordBuilder<K, V> {
    return new ZodRecordBuilder<K, V>(
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }
}

/** Build the record namespace factory methods. */
export function recordNamespace(
  parseError: (errorOrOpts?: string | { error?: string }) => string | undefined,
) {
  function buildRecord<K extends string, V>(
    k: ZodSchemaBuilder<K>,
    v: ZodSchemaBuilder<V>,
    mode: string,
    e?: string | { error?: string },
  ) {
    return new ZodRecordBuilder<K, V>([], [], parseError(e), {
      key: k.__schemaNode,
      value: v.__schemaNode,
      mode,
    });
  }
  return {
    record: <K extends string, V>(
      k: ZodSchemaBuilder<K>,
      v: ZodSchemaBuilder<V>,
      e?: string | { error?: string },
    ) => buildRecord(k, v, "strict", e),
    partialRecord: <K extends string, V>(
      k: ZodSchemaBuilder<K>,
      v: ZodSchemaBuilder<V>,
      e?: string | { error?: string },
    ) => buildRecord(k, v, "partial", e),
    looseRecord: <K extends string, V>(
      k: ZodSchemaBuilder<K>,
      v: ZodSchemaBuilder<V>,
      e?: string | { error?: string },
    ) => buildRecord(k, v, "loose", e),
  };
}

type SchemaBuildFn = (node: AnyZodSchemaNode) => AsyncGenerator<unknown, z.ZodType, unknown>;
interface ZodRecordNode extends ZodSchemaNodeBase {
  kind: "zod/record";
  key: AnyZodSchemaNode;
  value: AnyZodSchemaNode;
  mode?: RecordMode;
}

export function createRecordInterpreter(buildSchema: SchemaBuildFn): SchemaInterpreterMap {
  return {
    "zod/record": async function* (node: ZodRecordNode) {
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
