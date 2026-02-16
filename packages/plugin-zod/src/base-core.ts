import type { Expr, PluginContext, TypedNode } from "@mvfm/core";
import type {
  CheckDescriptor,
  ErrorConfig,
  RefinementDescriptor,
  SchemaASTNode,
  WrapperASTNode,
} from "./types";

export abstract class ZodSchemaBuilderCore<T> {
  protected readonly _ctx: PluginContext;
  protected readonly _kind: string;
  protected readonly _checks: readonly CheckDescriptor[];
  protected readonly _refinements: readonly RefinementDescriptor[];
  protected readonly _error: ErrorConfig | undefined;
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

  get __schemaNode(): SchemaASTNode | WrapperASTNode {
    return this._buildSchemaNode();
  }

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

  protected abstract _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: ErrorConfig;
    extra?: Record<string, unknown>;
  }): ZodSchemaBuilderCore<T>;

  protected _addCheck(
    kind: string,
    params: Record<string, unknown> = {},
    opts?: { error?: string; abort?: boolean; when?: TypedNode },
  ): this {
    const check: CheckDescriptor = { kind, ...params };
    if (opts?.error !== undefined) check.error = opts.error;
    if (opts?.abort !== undefined) check.abort = opts.abort;
    if (opts?.when !== undefined) check.when = opts.when;
    return this._clone({ checks: [...this._checks, check] }) as this;
  }

  protected _withExtra(extra: Record<string, unknown>): this {
    return this._clone({ extra: { ...this._extra, ...extra } }) as this;
  }

  private _buildValidationNode(
    opKind: string,
    input: Expr<unknown> | unknown,
    opts?: { error?: ErrorConfig },
  ): TypedNode {
    const node = {
      kind: opKind,
      schema: this._buildSchemaNode(),
      input: this._ctx.lift(input).__node,
    } as TypedNode & { parseError?: ErrorConfig };

    if (opts?.error !== undefined) {
      node.parseError = opts.error;
    }

    return node;
  }

  parse(input: Expr<unknown> | unknown, opts?: { error?: ErrorConfig }): Expr<T> {
    return this._ctx.expr<T>(this._buildValidationNode("zod/parse", input, opts));
  }

  safeParse(
    input: Expr<unknown> | unknown,
    opts?: { error?: ErrorConfig },
  ): Expr<{ success: boolean; data: T; error: unknown }> {
    return this._ctx.expr<{ success: boolean; data: T; error: unknown }>(
      this._buildValidationNode("zod/safe_parse", input, opts),
    );
  }

  parseAsync(input: Expr<unknown> | unknown, opts?: { error?: ErrorConfig }): Expr<Promise<T>> {
    return this._ctx.expr<Promise<T>>(this._buildValidationNode("zod/parse_async", input, opts));
  }

  safeParseAsync(
    input: Expr<unknown> | unknown,
    opts?: { error?: ErrorConfig },
  ): Expr<Promise<{ success: boolean; data: T; error: unknown }>> {
    return this._ctx.expr<Promise<{ success: boolean; data: T; error: unknown }>>(
      this._buildValidationNode("zod/safe_parse_async", input, opts),
    );
  }

  private _buildRefinement(
    kind: RefinementDescriptor["kind"],
    fn: (val: Expr<T>) => Expr<unknown> | undefined,
    opts?: { error?: string; abort?: boolean; path?: string[]; when?: TypedNode },
  ): RefinementDescriptor {
    const paramNode = { kind: "core/lambda_param", name: "refine_val" } as TypedNode;
    const paramProxy = this._ctx.expr<T>(paramNode);
    const result = fn(paramProxy);
    const bodyNode = result && this._ctx.isExpr(result) ? result.__node : paramNode;

    const refinement: RefinementDescriptor = {
      kind,
      fn: { kind: "core/lambda", param: paramNode, body: bodyNode } as TypedNode,
    };

    if (opts?.error !== undefined) refinement.error = opts.error;
    if (opts?.abort !== undefined) refinement.abort = opts.abort;
    if (opts?.path !== undefined) refinement.path = opts.path;
    if (opts?.when !== undefined) refinement.when = opts.when;

    return refinement;
  }

  refine(
    predicate: (val: Expr<T>) => Expr<boolean>,
    opts?: { error?: string; abort?: boolean; path?: string[]; when?: TypedNode },
  ): this {
    const refinement = this._buildRefinement("refine", predicate, opts);
    return this._clone({ refinements: [...this._refinements, refinement] }) as this;
  }

  superRefine(
    fn: (val: Expr<T>) => Expr<unknown> | undefined,
    opts?: { error?: string; abort?: boolean; when?: TypedNode },
  ): this {
    const refinement = this._buildRefinement("super_refine", fn, opts);
    return this._clone({ refinements: [...this._refinements, refinement] }) as this;
  }

  check(
    fn: (val: Expr<T>) => Expr<boolean>,
    opts?: { error?: string; abort?: boolean; path?: string[]; when?: TypedNode },
  ): this {
    const refinement = this._buildRefinement("check", fn, opts);
    return this._clone({ refinements: [...this._refinements, refinement] }) as this;
  }

  overwrite(fn: (val: Expr<T>) => Expr<T>, opts?: { error?: string; when?: TypedNode }): this {
    const refinement = this._buildRefinement("overwrite", fn, opts);
    return this._clone({ refinements: [...this._refinements, refinement] }) as this;
  }
}
