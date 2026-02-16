import type { ASTNode, PluginContext, StepEffect } from "@mvfm/core";
import { z } from "zod";
import { ZodSchemaBuilder } from "./base";
import type { SchemaInterpreterMap } from "./interpreter-utils";
import { checkErrorOpt, toZodError } from "./interpreter-utils";
import type { CheckDescriptor, ErrorConfig, RefinementDescriptor } from "./types";

/**
 * Builder for Zod map schemas.
 *
 * Stores key and value schemas as AST nodes in extra fields.
 *
 * @typeParam K - The key type
 * @typeParam V - The value type
 */
export class ZodMapBuilder<K, V> extends ZodSchemaBuilder<Map<K, V>> {
  constructor(
    ctx: PluginContext,
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super(ctx, "zod/map", checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: string | ASTNode;
    extra?: Record<string, unknown>;
  }): ZodMapBuilder<K, V> {
    return new ZodMapBuilder<K, V>(
      this._ctx,
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }
}

/**
 * Builder for Zod set schemas with size constraints.
 *
 * Stores value schema as AST node in extra field.
 * Provides min, max, and size check methods.
 *
 * @typeParam T - The element type
 */
export class ZodSetBuilder<T> extends ZodSchemaBuilder<Set<T>> {
  constructor(
    ctx: PluginContext,
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super(ctx, "zod/set", checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: string | ASTNode;
    extra?: Record<string, unknown>;
  }): ZodSetBuilder<T> {
    return new ZodSetBuilder<T>(
      this._ctx,
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }

  /** Require at least `value` elements. */
  min(value: number, opts?: { error?: string }): ZodSetBuilder<T> {
    return this._addCheck("min_size", { value }, opts) as ZodSetBuilder<T>;
  }

  /** Require at most `value` elements. */
  max(value: number, opts?: { error?: string }): ZodSetBuilder<T> {
    return this._addCheck("max_size", { value }, opts) as ZodSetBuilder<T>;
  }

  /** Require exactly `value` elements. */
  size(value: number, opts?: { error?: string }): ZodSetBuilder<T> {
    return this._addCheck("size", { value }, opts) as ZodSetBuilder<T>;
  }
}

/** Node kinds contributed by the map/set schemas. */
export const mapSetNodeKinds: string[] = ["zod/map", "zod/set"];

/**
 * Namespace fragment for map and set schema factories.
 */
export interface ZodMapSetNamespace {
  /** Create a map schema builder. */
  map<K, V>(
    keySchema: ZodSchemaBuilder<K>,
    valueSchema: ZodSchemaBuilder<V>,
    errorOrOpts?: string | { error?: string },
  ): ZodMapBuilder<K, V>;

  /** Create a set schema builder with optional size constraints. */
  set<T>(
    valueSchema: ZodSchemaBuilder<T>,
    errorOrOpts?: string | { error?: string },
  ): ZodSetBuilder<T>;
}

/** Build the map/set namespace factory methods. */
export function mapSetNamespace(
  ctx: PluginContext,
  parseError: (errorOrOpts?: string | { error?: string }) => string | undefined,
): ZodMapSetNamespace {
  return {
    map<K, V>(
      keySchema: ZodSchemaBuilder<K>,
      valueSchema: ZodSchemaBuilder<V>,
      errorOrOpts?: string | { error?: string },
    ): ZodMapBuilder<K, V> {
      const error = parseError(errorOrOpts);
      return new ZodMapBuilder<K, V>(ctx, [], [], error, {
        key: keySchema.__schemaNode,
        value: valueSchema.__schemaNode,
      });
    },

    set<T>(
      valueSchema: ZodSchemaBuilder<T>,
      errorOrOpts?: string | { error?: string },
    ): ZodSetBuilder<T> {
      const error = parseError(errorOrOpts);
      return new ZodSetBuilder<T>(ctx, [], [], error, {
        value: valueSchema.__schemaNode,
      });
    },
  };
}

/**
 * Build a Zod schema from a field's AST node by delegating to the
 * interpreter's buildSchemaGen. This is passed in at registration time
 * to avoid circular imports.
 */
type SchemaBuildFn = (node: ASTNode) => Generator<StepEffect, z.ZodType, unknown>;

/** Create map/set interpreter handlers with access to the shared schema builder. */
export function createMapSetInterpreter(buildSchema: SchemaBuildFn): SchemaInterpreterMap {
  return {
    "zod/map": function* (node: ASTNode): Generator<StepEffect, z.ZodType, unknown> {
      const keySchema = yield* buildSchema(node.key as ASTNode);
      const valueSchema = yield* buildSchema(node.value as ASTNode);
      const errorFn = toZodError(node.error as ErrorConfig | undefined);
      const errOpt = errorFn ? { error: errorFn } : {};
      return z.map(keySchema as z.ZodString, valueSchema, errOpt);
    },

    "zod/set": function* (node: ASTNode): Generator<StepEffect, z.ZodType, unknown> {
      const valueSchema = yield* buildSchema(node.value as ASTNode);
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
