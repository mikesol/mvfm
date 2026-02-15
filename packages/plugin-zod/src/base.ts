import type { ASTNode, Expr, PluginContext } from "@mvfm/core";
import type { CheckDescriptor, ErrorConfig, RefinementDescriptor, SchemaASTNode } from "./types";

// ============================================================
// ZodSchemaBuilder<T> — Base class for all Zod schema types
// ============================================================
//
// Every Zod schema type (string, number, object, etc.) extends this.
// Common methods — parse, safeParse, refine, optional, nullable, etc. —
// live here so all schemas inherit them automatically.
//
// Design:
// - Immutable chaining: each method returns a NEW instance (via _clone)
// - Schema AST: { kind: "zod/string", checks: [...], refinements: [...] }
// - Wrappers: { kind: "zod/optional", inner: SchemaNode }
// ============================================================

/**
 * Base builder for all Zod schema types in the mvfm DSL.
 *
 * Provides the common interface that every schema inherits:
 * parsing (parse, safeParse), refinements (refine, check),
 * wrappers (optional, nullable, default), and error config.
 *
 * Subclasses (ZodStringBuilder, ZodNumberBuilder, etc.) add
 * type-specific methods (min, max, regex, gt, etc.).
 *
 * @typeParam T - The output type this schema validates to
 */
export abstract class ZodSchemaBuilder<T> {
  /** mvfm plugin context for creating Exprs and AST nodes */
  protected readonly _ctx: PluginContext;

  /** The base schema kind (e.g. "zod/string", "zod/number") */
  protected readonly _kind: string;

  /** Accumulated check descriptors */
  protected readonly _checks: readonly CheckDescriptor[];

  /** Accumulated refinement descriptors */
  protected readonly _refinements: readonly RefinementDescriptor[];

  /** Schema-level error config */
  protected readonly _error: ErrorConfig | undefined;

  /** Additional schema-specific fields (e.g. variant, format, shape) */
  protected readonly _extra: Readonly<Record<string, unknown>>;

  constructor(
    ctx: PluginContext,
    kind: string,
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    this._ctx = ctx;
    this._kind = kind;
    this._checks = checks;
    this._refinements = refinements;
    this._error = error;
    this._extra = extra;
  }

  // ---- Internal helpers (used by subclasses & foundation issues) ----

  /**
   * Build the final schema AST node from accumulated state.
   * Combines kind + checks + refinements + error + extra fields.
   */
  protected _buildSchemaNode(): SchemaASTNode {
    const node: SchemaASTNode = {
      kind: this._kind,
      checks: [...this._checks],
      refinements: [...this._refinements],
      ...this._extra,
    };
    if (this._error !== undefined) {
      node.error = this._error;
    }
    return node;
  }

  /**
   * Create a new instance of this builder with modified state.
   * Subclasses MUST override this to return their own type.
   *
   * @param overrides - Fields to override on the new instance
   */
  protected abstract _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: ErrorConfig;
    extra?: Record<string, unknown>;
  }): ZodSchemaBuilder<T>;

  /**
   * Add a check descriptor (used by subclass methods like .min(), .max(), .gt()).
   * Returns a new builder instance (immutable chaining).
   *
   * @param kind - Check kind (e.g. "min_length", "gt", "regex")
   * @param params - Check-specific params (e.g. { value: 5 })
   * @param opts - Optional error/abort/when config
   */
  protected _addCheck(
    kind: string,
    params: Record<string, unknown> = {},
    opts?: { error?: string; abort?: boolean; when?: ASTNode },
  ): this {
    const check: CheckDescriptor = { kind, ...params };
    if (opts?.error !== undefined) check.error = opts.error;
    if (opts?.abort !== undefined) check.abort = opts.abort;
    if (opts?.when !== undefined) check.when = opts.when;
    return this._clone({
      checks: [...this._checks, check],
    }) as this;
  }

  /**
   * Set or update extra schema-specific fields.
   * Returns a new builder instance (immutable chaining).
   */
  protected _withExtra(extra: Record<string, unknown>): this {
    return this._clone({
      extra: { ...this._extra, ...extra },
    }) as this;
  }

  // ---- Parsing operations (#96, #97) ----

  /**
   * Build a validation AST node with the given operation kind.
   * Handles per-parse error config if provided.
   */
  private _buildValidationNode(
    opKind: string,
    input: Expr<unknown> | unknown,
    opts?: { error?: ErrorConfig },
  ): ASTNode {
    const node: ASTNode & { parseError?: ErrorConfig } = {
      kind: opKind,
      schema: this._buildSchemaNode(),
      input: this._ctx.lift(input).__node,
    };
    if (opts?.error !== undefined) {
      node.parseError = opts.error;
    }
    return node;
  }

  /** Validate input and return data or throw. Produces `zod/parse` AST node. */
  parse(input: Expr<unknown> | unknown, opts?: { error?: ErrorConfig }): Expr<T> {
    return this._ctx.expr<T>(this._buildValidationNode("zod/parse", input, opts));
  }

  /** Validate input and return result object. Produces `zod/safe_parse` AST node. */
  safeParse(
    input: Expr<unknown> | unknown,
    opts?: { error?: ErrorConfig },
  ): Expr<{ success: boolean; data: T; error: unknown }> {
    return this._ctx.expr<{ success: boolean; data: T; error: unknown }>(
      this._buildValidationNode("zod/safe_parse", input, opts),
    );
  }

  /** Async variant of `parse`. Produces `zod/parse_async` AST node. */
  parseAsync(input: Expr<unknown> | unknown, opts?: { error?: ErrorConfig }): Expr<Promise<T>> {
    return this._ctx.expr<Promise<T>>(this._buildValidationNode("zod/parse_async", input, opts));
  }

  /** Async variant of `safeParse`. Produces `zod/safe_parse_async` AST node. */
  safeParseAsync(
    input: Expr<unknown> | unknown,
    opts?: { error?: ErrorConfig },
  ): Expr<Promise<{ success: boolean; data: T; error: unknown }>> {
    return this._ctx.expr<Promise<{ success: boolean; data: T; error: unknown }>>(
      this._buildValidationNode("zod/safe_parse_async", input, opts),
    );
  }

  // ---- Refinement methods (implemented by #98) ----
  // Stubs declared here. #98 will enhance these.

  /**
   * Add a custom refinement predicate.
   * The predicate callback receives an Expr<T> and must return Expr<boolean>.
   * @stub Implemented by #98
   */
  refine(
    _predicate: (val: Expr<T>) => Expr<boolean>,
    _opts?: {
      error?: string;
      abort?: boolean;
      path?: string[];
      when?: ASTNode;
    },
  ): ZodSchemaBuilder<T> {
    // Stub — #98 replaces with real implementation
    return this._clone();
  }

  // ---- Wrapper methods (implemented by #99) ----
  // Stubs declared here. #99 will enhance these.

  /** @stub Implemented by #99 */
  optional(): ZodSchemaBuilder<T | undefined> {
    // Stub — #99 replaces with real implementation
    return this as unknown as ZodSchemaBuilder<T | undefined>;
  }

  /** @stub Implemented by #99 */
  nullable(): ZodSchemaBuilder<T | null> {
    // Stub — #99 replaces with real implementation
    return this as unknown as ZodSchemaBuilder<T | null>;
  }
}
