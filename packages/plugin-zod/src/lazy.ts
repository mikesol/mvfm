import type { PluginContext, TypedNode } from "@mvfm/core";
import { z } from "zod";
import { ZodSchemaBuilder } from "./base";
import type {
  AnyZodSchemaNode,
  CheckDescriptor,
  ErrorConfig,
  RefinementDescriptor,
  SchemaASTNode,
  WrapperASTNode,
  ZodSchemaNodeBase,
} from "./types";

export interface ZodLazyNode extends ZodSchemaNodeBase {
  kind: "zod/lazy";
  // Instead of storing the resolved schema, we store a unique ID
  // The actual schema will be resolved during interpretation
  ref: string;
}

// Global registry for lazy schema functions
// Maps ref ID to the actual schema getter function
const lazySchemaRegistry = new Map<string, () => AnyZodSchemaNode>();
let lazyRefCounter = 0;

/**
 * Builder for Zod lazy schemas.
 *
 * Supports recursive and mutually recursive schemas by wrapping
 * the schema in a getter function (`z.lazy(() => schema)`).
 *
 * The lazy builder stores a unique reference ID in the AST and registers
 * the schema getter function in a global registry. This allows circular
 * references to be resolved during interpretation.
 *
 * @typeParam T - The output type this schema validates to
 */
export class ZodLazyBuilder<T> extends ZodSchemaBuilder<T> {
  private _ref: string;
  private _lazyFn: () => ZodSchemaBuilder<T>;

  constructor(
    ctx: PluginContext,
    lazyFn: () => ZodSchemaBuilder<T>,
    ref?: string,
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super(ctx, "zod/lazy", checks, refinements, error, extra);
    this._ref = ref ?? `lazy_${lazyRefCounter++}`;
    this._lazyFn = lazyFn;
    // Register the function that will return the schema node
    lazySchemaRegistry.set(this._ref, () => {
      const builder = this._lazyFn();
      return builder.__schemaNode as AnyZodSchemaNode;
    });
  }

  /** Override to set the ref field in the schema node. */
  protected _buildSchemaNode(): SchemaASTNode {
    const node = super._buildSchemaNode();
    // Add the ref field to the schema node
    const lazyNode: ZodLazyNode = node as ZodLazyNode;
    lazyNode.ref = this._ref;
    return lazyNode;
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: string | TypedNode;
    extra?: Record<string, unknown>;
  }): ZodLazyBuilder<T> {
    return new ZodLazyBuilder<T>(
      this._ctx,
      this._lazyFn,
      this._ref, // Keep the same ref
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }
}

/** Node kinds contributed by the lazy schema. */
export const lazyNodeKinds: string[] = ["zod/lazy"];

/** Get the schema getter function for a lazy reference. */
export function getLazySchema(ref: string): AnyZodSchemaNode | undefined {
  const getter = lazySchemaRegistry.get(ref);
  return getter ? getter() : undefined;
}

/**
 * Namespace fragment for lazy schema factories.
 */
export interface ZodLazyNamespace {
  /**
   * Create a lazy schema for recursive or mutually recursive structures.
   *
   * @example
   * ```ts
   * const Category = $.zod.object({
   *   name: $.zod.string(),
   *   subcategories: $.zod.lazy(() => $.zod.array(Category))
   * });
   * ```
   */
  lazy<T>(fn: () => ZodSchemaBuilder<T>): ZodLazyBuilder<T>;
}

/** Build the lazy namespace factory methods. */
export function lazyNamespace(ctx: PluginContext): ZodLazyNamespace {
  return {
    lazy<T>(fn: () => ZodSchemaBuilder<T>): ZodLazyBuilder<T> {
      return new ZodLazyBuilder<T>(ctx, fn);
    },
  };
}
