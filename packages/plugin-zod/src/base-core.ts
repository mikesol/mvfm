import type { CExpr } from "@mvfm/core";
import { isCExpr, makeCExpr } from "@mvfm/core";
import { extractCExprs } from "./extract-cexprs";
import type {
  CheckDescriptor,
  ErrorConfig,
  RefinementDescriptor,
  SchemaASTNode,
  WrapperASTNode,
} from "./types";

export abstract class ZodSchemaBuilderCore<T> {
  protected readonly _kind: string;
  protected readonly _checks: readonly CheckDescriptor[];
  protected readonly _refinements: readonly RefinementDescriptor[];
  protected readonly _error: ErrorConfig | undefined;
  protected readonly _extra: Readonly<Record<string, unknown>>;

  constructor(
    kind: string,
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
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
    opts?: { error?: string; abort?: boolean; when?: unknown },
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

  private _buildValidationCExpr<R>(
    opKind: string,
    input: unknown,
    opts?: { error?: ErrorConfig },
  ): CExpr<R> {
    const rawSchema = this._buildSchemaNode();
    const resolver = _lazyResolver;
    const descriptor: Record<string, unknown> = {
      schema: resolver ? resolver(rawSchema) : rawSchema,
    };
    if (opts?.error !== undefined) {
      descriptor.parseError = opts.error;
    }
    const { serialized, refs } = extractCExprs(descriptor);
    return makeCExpr<R, string, unknown[]>(opKind, [serialized, input, ...refs]);
  }

  parse(input: unknown, opts?: { error?: ErrorConfig }): CExpr<T, "zod/parse"> {
    return this._buildValidationCExpr<T>("zod/parse", input, opts) as CExpr<T, "zod/parse">;
  }

  safeParse(
    input: unknown,
    opts?: { error?: ErrorConfig },
  ): CExpr<{ success: boolean; data: T; error: unknown }, "zod/safe_parse"> {
    return this._buildValidationCExpr<{ success: boolean; data: T; error: unknown }>(
      "zod/safe_parse",
      input,
      opts,
    ) as CExpr<{ success: boolean; data: T; error: unknown }, "zod/safe_parse">;
  }

  parseAsync(input: unknown, opts?: { error?: ErrorConfig }): CExpr<Promise<T>, "zod/parse_async"> {
    return this._buildValidationCExpr<Promise<T>>("zod/parse_async", input, opts) as CExpr<
      Promise<T>,
      "zod/parse_async"
    >;
  }

  safeParseAsync(
    input: unknown,
    opts?: { error?: ErrorConfig },
  ): CExpr<Promise<{ success: boolean; data: T; error: unknown }>, "zod/safe_parse_async"> {
    return this._buildValidationCExpr<Promise<{ success: boolean; data: T; error: unknown }>>(
      "zod/safe_parse_async",
      input,
      opts,
    ) as CExpr<Promise<{ success: boolean; data: T; error: unknown }>, "zod/safe_parse_async">;
  }

  private _buildRefinement(
    kind: RefinementDescriptor["kind"],
    fn: (val: CExpr<T>) => CExpr<unknown> | undefined,
    opts?: { error?: string; abort?: boolean; path?: string[]; when?: unknown },
  ): RefinementDescriptor {
    const param = makeCExpr<T, "core/lambda_param", []>("core/lambda_param", []);
    const result = fn(param);
    const body = result && isCExpr(result) ? result : param;

    const refinement: RefinementDescriptor = {
      kind,
      fn: { param, body },
    };

    if (opts?.error !== undefined) refinement.error = opts.error;
    if (opts?.abort !== undefined) refinement.abort = opts.abort;
    if (opts?.path !== undefined) refinement.path = opts.path;
    if (opts?.when !== undefined) refinement.when = opts.when;

    return refinement;
  }

  refine(
    predicate: (val: CExpr<T>) => CExpr<boolean>,
    opts?: { error?: string; abort?: boolean; path?: string[]; when?: unknown },
  ): this {
    const refinement = this._buildRefinement("refine", predicate, opts);
    return this._clone({ refinements: [...this._refinements, refinement] }) as this;
  }

  superRefine(
    fn: (val: CExpr<T>) => CExpr<unknown> | undefined,
    opts?: { error?: string; abort?: boolean; when?: unknown },
  ): this {
    const refinement = this._buildRefinement("super_refine", fn, opts);
    return this._clone({ refinements: [...this._refinements, refinement] }) as this;
  }

  check(
    fn: (val: CExpr<T>) => CExpr<boolean>,
    opts?: { error?: string; abort?: boolean; path?: string[]; when?: unknown },
  ): this {
    const refinement = this._buildRefinement("check", fn, opts);
    return this._clone({ refinements: [...this._refinements, refinement] }) as this;
  }

  overwrite(fn: (val: CExpr<T>) => CExpr<T>, opts?: { error?: string; when?: unknown }): this {
    const refinement = this._buildRefinement("overwrite", fn, opts);
    return this._clone({ refinements: [...this._refinements, refinement] }) as this;
  }
}

/**
 * Module-level lazy resolver. Set by lazyNamespace() at build time.
 * Used by _buildValidationCExpr to resolve lazy schema references before serialization.
 */
let _lazyResolver:
  | ((schema: SchemaASTNode | WrapperASTNode) => SchemaASTNode | WrapperASTNode)
  | undefined;

/** Set the lazy schema resolver (called by lazy.ts). */
export function setLazyResolver(
  resolver: (schema: SchemaASTNode | WrapperASTNode) => SchemaASTNode | WrapperASTNode,
): void {
  _lazyResolver = resolver;
}
