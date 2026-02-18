import type { PluginContext, TypedNode } from "@mvfm/core";
import type { z } from "zod";
import { ZodSchemaBuilder } from "./base";
import { type ConvertState, convertZodSchemaToNode } from "./from-zod-convert";
import type { CheckDescriptor, RefinementDescriptor, SchemaASTNode, WrapperASTNode } from "./types";

/**
 * Options for `$.zod.from(...)`.
 */
export interface ZodFromOptions {
  /**
   * When true (default), throw if conversion encounters closure-based constructs
   * (for example refinements/custom checks). When false, drop those constructs and
   * emit warnings.
   */
  strict?: boolean;
}

class ZodImportedBuilder<T> extends ZodSchemaBuilder<T> {
  constructor(
    ctx: PluginContext,
    private readonly node: SchemaASTNode | WrapperASTNode,
  ) {
    super(ctx, node.kind);
  }

  protected _buildSchemaNode(): SchemaASTNode | WrapperASTNode {
    return this.node;
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: string | TypedNode;
    extra?: Record<string, unknown>;
  }): ZodImportedBuilder<T> {
    if ("checks" in this.node && "refinements" in this.node) {
      const base = this.node as SchemaASTNode;
      return new ZodImportedBuilder<T>(this._ctx, {
        ...base,
        checks: [...(overrides?.checks ?? base.checks)],
        refinements: [...(overrides?.refinements ?? base.refinements)],
        ...(overrides?.error !== undefined ? { error: overrides.error } : {}),
        ...(overrides?.extra ?? {}),
      });
    }
    return new ZodImportedBuilder<T>(this._ctx, this.node);
  }
}

/**
 * Namespace fragment for converting runtime Zod schemas into mvfm schema builders.
 */
export interface ZodFromNamespace {
  /** Convert a runtime Zod schema into an mvfm `$.zod` schema builder. */
  from<T>(schema: z.ZodType<T>, options?: ZodFromOptions): ZodSchemaBuilder<T>;
}

/**
 * Build the `$.zod.from(...)` converter method.
 */
export function fromZodNamespace(ctx: PluginContext): ZodFromNamespace {
  return {
    from<T>(schema: z.ZodType<T>, options?: ZodFromOptions): ZodSchemaBuilder<T> {
      const state: ConvertState = {
        ctx,
        strict: options?.strict ?? true,
        warnings: [],
        lazyIds: new WeakMap<object, string>(),
        activeLazy: new Set<object>(),
        nextLazyId: 0,
      };
      const node = convertZodSchemaToNode(schema, state);
      for (const warning of state.warnings) console.warn(`[zod.from] ${warning}`);
      return new ZodImportedBuilder<T>(ctx, node);
    },
  };
}
