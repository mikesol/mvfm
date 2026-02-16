import type { PluginContext, TypedNode } from "@mvfm/core";
import { ZodSchemaBuilder } from "./base";
import type {
  CheckDescriptor,
  ErrorConfig,
  RefinementDescriptor,
  SchemaASTNode,
  WrapperASTNode,
} from "./types";

/**
 * Builder for Zod tuple schemas.
 *
 * Represents fixed-length typed arrays with optional variadic rest element.
 * Items are stored as AST nodes in the `items` extra field, and the optional
 * rest element in the `rest` extra field.
 *
 * @typeParam T - The tuple output type
 */
export class ZodTupleBuilder<T extends unknown[]> extends ZodSchemaBuilder<T> {
  constructor(
    ctx: PluginContext,
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super(ctx, "zod/tuple", checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: string | TypedNode;
    extra?: Record<string, unknown>;
  }): ZodTupleBuilder<T> {
    return new ZodTupleBuilder<T>(
      this._ctx,
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }
}

/** Convert an array of schema builders to an array of AST nodes. */
export function itemsToAST(items: ZodSchemaBuilder<unknown>[]): (SchemaASTNode | WrapperASTNode)[] {
  return items.map((builder) => builder.__schemaNode);
}

/** Node kinds registered by the tuple schema. */
export const tupleNodeKinds: string[] = ["zod/tuple"];

/**
 * Namespace fragment for tuple schema factories.
 */
export interface ZodTupleNamespace {
  /** Create a tuple schema builder with fixed items and optional rest element. */
  tuple<T extends unknown[]>(
    items: { [K in keyof T]: ZodSchemaBuilder<T[K]> },
    rest?: ZodSchemaBuilder<unknown>,
    errorOrOpts?: string | { error?: string },
  ): ZodTupleBuilder<T>;
}

/** Build the tuple namespace factory methods. */
export function tupleNamespace(
  ctx: PluginContext,
  parseError: (errorOrOpts?: string | { error?: string }) => string | undefined,
): ZodTupleNamespace {
  return {
    tuple<T extends unknown[]>(
      items: { [K in keyof T]: ZodSchemaBuilder<T[K]> },
      rest?: ZodSchemaBuilder<unknown>,
      errorOrOpts?: string | { error?: string },
    ): ZodTupleBuilder<T> {
      const error = parseError(errorOrOpts);
      const extra: Record<string, unknown> = {
        items: itemsToAST(items as ZodSchemaBuilder<unknown>[]),
      };
      if (rest) {
        extra.rest = rest.__schemaNode;
      }
      return new ZodTupleBuilder<T>(ctx, [], [], error, extra);
    },
  };
}
