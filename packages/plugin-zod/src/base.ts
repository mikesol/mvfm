import type { ASTNode, Expr, PluginContext } from "@mvfm/core";
import type {
  CheckDescriptor,
  ErrorConfig,
  RefinementDescriptor,
  SchemaASTNode,
  WrapperASTNode,
} from "./types";

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
  protected _buildSchemaNode(): SchemaASTNode | WrapperASTNode {
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

  // ---- Wrapper methods (#99) ----

  /**
   * Build a wrapper node around this schema's AST.
   * Used internally by wrapper methods.
   */
  private _wrap<U>(wrapperKind: string, extra?: Record<string, unknown>): ZodWrappedBuilder<U> {
    const wrapperNode: WrapperASTNode = {
      kind: wrapperKind,
      inner: this._buildSchemaNode(),
      ...extra,
    };
    return new ZodWrappedBuilder<U>(this._ctx, wrapperNode);
  }

  /** Allow `undefined`. Produces `zod/optional` wrapper node. */
  optional(): ZodWrappedBuilder<T | undefined> {
    return this._wrap<T | undefined>("zod/optional");
  }

  /** Remove optional. Produces `zod/nonoptional` wrapper node. */
  nonoptional(): ZodWrappedBuilder<NonNullable<T>> {
    return this._wrap<NonNullable<T>>("zod/nonoptional");
  }

  /** Allow `null`. Produces `zod/nullable` wrapper node. */
  nullable(): ZodWrappedBuilder<T | null> {
    return this._wrap<T | null>("zod/nullable");
  }

  /** Allow `null` or `undefined`. Produces `zod/nullish` wrapper node. */
  nullish(): ZodWrappedBuilder<T | null | undefined> {
    return this._wrap<T | null | undefined>("zod/nullish");
  }

  /** Provide default value when input is undefined. Produces `zod/default` wrapper node. */
  default(value: Expr<T> | T): ZodWrappedBuilder<T> {
    return this._wrap<T>("zod/default", { value: this._ctx.lift(value).__node });
  }

  /** Pre-parse default (parsed through the schema). Produces `zod/prefault` wrapper node. */
  prefault(value: Expr<T> | T): ZodWrappedBuilder<T> {
    return this._wrap<T>("zod/prefault", { value: this._ctx.lift(value).__node });
  }

  /** Fallback value on validation error. Produces `zod/catch` wrapper node. */
  catch(value: Expr<T> | T): ZodWrappedBuilder<T> {
    return this._wrap<T>("zod/catch", { value: this._ctx.lift(value).__node });
  }

  /** Mark output as readonly. Produces `zod/readonly` wrapper node. */
  readonly(): ZodWrappedBuilder<Readonly<T>> {
    return this._wrap<Readonly<T>>("zod/readonly");
  }

  /** Add a branded type tag (compile-time only). Produces `zod/branded` wrapper node. */
  brand<B extends string>(brand?: B): ZodWrappedBuilder<T & { __brand: B }> {
    return this._wrap<T & { __brand: B }>("zod/branded", brand ? { brand } : {});
  }
}

/**
 * Builder for wrapped Zod schemas (optional, nullable, default, etc.).
 *
 * Unlike regular schema builders which accumulate checks and produce a
 * schema node, a wrapped builder holds an already-built inner schema
 * and wraps it with a modifier node. The wrapped builder still inherits
 * all base methods (parse, safeParse, optional, nullable, etc.) so
 * wrappers can be composed: `$.zod.string().optional().nullable()`.
 *
 * @typeParam T - The output type after wrapping
 */
export class ZodWrappedBuilder<T> extends ZodSchemaBuilder<T> {
  /** The wrapper AST node (contains the inner schema) */
  private readonly _wrapperNode: WrapperASTNode;

  constructor(ctx: PluginContext, wrapperNode: WrapperASTNode) {
    super(ctx, wrapperNode.kind);
    this._wrapperNode = wrapperNode;
  }

  protected _buildSchemaNode(): WrapperASTNode {
    return this._wrapperNode;
  }

  protected _clone(): ZodWrappedBuilder<T> {
    return new ZodWrappedBuilder<T>(this._ctx, this._wrapperNode);
  }
}
