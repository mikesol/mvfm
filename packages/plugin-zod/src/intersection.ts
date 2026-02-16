import type { PluginContext, TypedNode } from "@mvfm/core";
import { z } from "zod";
import { ZodSchemaBuilder } from "./base";
import type { SchemaInterpreterMap } from "./interpreter-utils";
import type {
  AnyZodSchemaNode,
  CheckDescriptor,
  ErrorConfig,
  RefinementDescriptor,
  SchemaASTNode,
  WrapperASTNode,
  ZodSchemaNodeBase,
} from "./types";

/**
 * Builder for Zod intersection schemas (A & B).
 *
 * Stores left and right schemas as AST nodes in extra fields.
 *
 * @typeParam T - The intersection output type
 */
export class ZodIntersectionBuilder<T> extends ZodSchemaBuilder<T> {
  constructor(
    ctx: PluginContext,
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super(ctx, "zod/intersection", checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: string | TypedNode;
    extra?: Record<string, unknown>;
  }): ZodIntersectionBuilder<T> {
    return new ZodIntersectionBuilder<T>(
      this._ctx,
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }
}

/** Node kinds registered by the intersection schema. */
export const intersectionNodeKinds: string[] = ["zod/intersection"];

/**
 * Namespace fragment for intersection schema factory.
 */
export interface ZodIntersectionNamespace {
  /** Create an intersection schema builder (A & B). */
  intersection<A, B>(
    left: ZodSchemaBuilder<A>,
    right: ZodSchemaBuilder<B>,
    errorOrOpts?: string | { error?: string },
  ): ZodIntersectionBuilder<A & B>;
}

/** Build the intersection namespace factory methods. */
export function intersectionNamespace(
  ctx: PluginContext,
  parseError: (errorOrOpts?: string | { error?: string }) => string | undefined,
): ZodIntersectionNamespace {
  return {
    intersection<A, B>(
      left: ZodSchemaBuilder<A>,
      right: ZodSchemaBuilder<B>,
      errorOrOpts?: string | { error?: string },
    ): ZodIntersectionBuilder<A & B> {
      const error = parseError(errorOrOpts);
      return new ZodIntersectionBuilder<A & B>(ctx, [], [], error, {
        left: (left as ZodSchemaBuilder<unknown>).__schemaNode as SchemaASTNode | WrapperASTNode,
        right: (right as ZodSchemaBuilder<unknown>).__schemaNode as SchemaASTNode | WrapperASTNode,
      });
    },
  };
}

/**
 * Build a Zod schema from a field's AST node by delegating to the
 * interpreter's buildSchemaGen. This is passed in at registration time
 * to avoid circular imports.
 */
type SchemaBuildFn = (node: AnyZodSchemaNode) => AsyncGenerator<TypedNode, z.ZodType, unknown>;

interface ZodIntersectionNode extends ZodSchemaNodeBase {
  kind: "zod/intersection";
  left: AnyZodSchemaNode;
  right: AnyZodSchemaNode;
}

/** Create intersection interpreter handlers with access to the shared schema builder. */
export function createIntersectionInterpreter(buildSchema: SchemaBuildFn): SchemaInterpreterMap {
  return {
    "zod/intersection": async function* (
      node: ZodIntersectionNode,
    ): AsyncGenerator<TypedNode, z.ZodType, unknown> {
      const leftSchema = yield* buildSchema(node.left);
      const rightSchema = yield* buildSchema(node.right);
      return z.intersection(leftSchema, rightSchema);
    },
  };
}
