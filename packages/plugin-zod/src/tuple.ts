import { ZodSchemaBuilder } from "./base";
import type {
  CheckDescriptor,
  ErrorConfig,
  RefinementDescriptor,
  SchemaASTNode,
  WrapperASTNode,
} from "./types";

export class ZodTupleBuilder<T extends unknown[]> extends ZodSchemaBuilder<T> {
  constructor(
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super("zod/tuple", checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: ErrorConfig;
    extra?: Record<string, unknown>;
  }): ZodTupleBuilder<T> {
    return new ZodTupleBuilder<T>(
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }
}

export function itemsToAST(items: ZodSchemaBuilder<unknown>[]): (SchemaASTNode | WrapperASTNode)[] {
  return items.map((builder) => builder.__schemaNode);
}

/** Build the tuple namespace factory methods. */
export function tupleNamespace(
  parseError: (errorOrOpts?: string | { error?: string }) => string | undefined,
) {
  return {
    tuple: <T extends unknown[]>(
      items: { [K in keyof T]: ZodSchemaBuilder<T[K]> },
      rest?: ZodSchemaBuilder<unknown>,
      e?: string | { error?: string },
    ) => {
      const extra: Record<string, unknown> = {
        items: itemsToAST(items as ZodSchemaBuilder<unknown>[]),
      };
      if (rest) extra.rest = rest.__schemaNode;
      return new ZodTupleBuilder<T>([], [], parseError(e), extra);
    },
  };
}
