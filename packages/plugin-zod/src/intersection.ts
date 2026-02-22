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

export class ZodIntersectionBuilder<T> extends ZodSchemaBuilder<T> {
  constructor(
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super("zod/intersection", checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: ErrorConfig;
    extra?: Record<string, unknown>;
  }): ZodIntersectionBuilder<T> {
    return new ZodIntersectionBuilder<T>(
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }
}

/** Build the intersection namespace factory methods. */
export function intersectionNamespace(
  parseError: (errorOrOpts?: string | { error?: string }) => string | undefined,
) {
  return {
    intersection: <A, B>(
      left: ZodSchemaBuilder<A>,
      right: ZodSchemaBuilder<B>,
      e?: string | { error?: string },
    ) =>
      new ZodIntersectionBuilder<A & B>([], [], parseError(e), {
        left: (left as ZodSchemaBuilder<unknown>).__schemaNode as SchemaASTNode | WrapperASTNode,
        right: (right as ZodSchemaBuilder<unknown>).__schemaNode as SchemaASTNode | WrapperASTNode,
      }),
  };
}

type SchemaBuildFn = (node: AnyZodSchemaNode) => AsyncGenerator<unknown, z.ZodType, unknown>;

interface ZodIntersectionNode extends ZodSchemaNodeBase {
  kind: "zod/intersection";
  left: AnyZodSchemaNode;
  right: AnyZodSchemaNode;
}

export function createIntersectionInterpreter(buildSchema: SchemaBuildFn): SchemaInterpreterMap {
  return {
    "zod/intersection": async function* (node: ZodIntersectionNode) {
      const leftSchema = yield* buildSchema(node.left);
      const rightSchema = yield* buildSchema(node.right);
      return z.intersection(leftSchema, rightSchema);
    },
  };
}
