import type { PluginContext, TypedNode } from "@mvfm/core";
import { z } from "zod";
import { ZodSchemaBuilder } from "./base";
import type { SchemaInterpreterMap } from "./interpreter-utils";
import { toZodError } from "./interpreter-utils";
import type {
  CheckDescriptor,
  ErrorConfig,
  RefinementDescriptor,
  SchemaASTNode,
  WrapperASTNode,
} from "./types";

/** A shape mapping field names to schema builders. */
export type ShapeInput = Record<string, ZodSchemaBuilder<unknown>>;

/** Convert a shape of builders to a shape of AST nodes. */
function shapeToAST(shape: ShapeInput): Record<string, SchemaASTNode | WrapperASTNode> {
  const result: Record<string, SchemaASTNode | WrapperASTNode> = {};
  for (const [key, builder] of Object.entries(shape)) {
    result[key] = builder.__schemaNode;
  }
  return result;
}

/**
 * Builder for Zod object schemas.
 *
 * Provides object-specific operations: extend, pick, omit, partial, required.
 * Shape fields are stored as AST nodes in the `shape` extra field.
 *
 * @typeParam T - The object output type
 */
export class ZodObjectBuilder<T extends Record<string, unknown>> extends ZodSchemaBuilder<T> {
  constructor(
    ctx: PluginContext,
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super(ctx, "zod/object", checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: string | TypedNode;
    extra?: Record<string, unknown>;
  }): ZodObjectBuilder<T> {
    return new ZodObjectBuilder<T>(
      this._ctx,
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }

  /** Extend this object with additional fields. */
  extend(shape: ShapeInput): ZodObjectBuilder<T> {
    const currentShape = (this._extra.shape as Record<string, unknown>) ?? {};
    return this._clone({
      extra: { ...this._extra, shape: { ...currentShape, ...shapeToAST(shape) } },
    }) as ZodObjectBuilder<T>;
  }

  /** Pick specific fields from this object. */
  pick(mask: Record<string, true>): ZodObjectBuilder<T> {
    const currentShape = (this._extra.shape as Record<string, unknown>) ?? {};
    const picked: Record<string, unknown> = {};
    for (const key of Object.keys(mask)) {
      if (key in currentShape) picked[key] = currentShape[key];
    }
    return this._clone({
      extra: { ...this._extra, shape: picked },
    }) as ZodObjectBuilder<T>;
  }

  /** Omit specific fields from this object. */
  omit(mask: Record<string, true>): ZodObjectBuilder<T> {
    const currentShape = (this._extra.shape as Record<string, unknown>) ?? {};
    const remaining: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(currentShape)) {
      if (!(key in mask)) remaining[key] = val;
    }
    return this._clone({
      extra: { ...this._extra, shape: remaining },
    }) as ZodObjectBuilder<T>;
  }

  /** Make all or specific fields optional by wrapping them with zod/optional. */
  partial(mask?: Record<string, true>): ZodObjectBuilder<T> {
    const currentShape =
      (this._extra.shape as Record<string, SchemaASTNode | WrapperASTNode>) ?? {};
    const modified: Record<string, SchemaASTNode | WrapperASTNode> = {};
    for (const [key, schema] of Object.entries(currentShape)) {
      if (!mask || key in mask) {
        modified[key] = { kind: "zod/optional", inner: schema };
      } else {
        modified[key] = schema;
      }
    }
    return this._clone({
      extra: { ...this._extra, shape: modified },
    }) as ZodObjectBuilder<T>;
  }

  /** Make all or specific fields required by unwrapping zod/optional. */
  required(mask?: Record<string, true>): ZodObjectBuilder<T> {
    const currentShape =
      (this._extra.shape as Record<string, SchemaASTNode | WrapperASTNode>) ?? {};
    const modified: Record<string, SchemaASTNode | WrapperASTNode> = {};
    for (const [key, schema] of Object.entries(currentShape)) {
      if (!mask || key in mask) {
        if (schema.kind === "zod/optional" && "inner" in schema) {
          modified[key] = schema.inner as SchemaASTNode | WrapperASTNode;
        } else {
          modified[key] = schema;
        }
      } else {
        modified[key] = schema;
      }
    }
    return this._clone({
      extra: { ...this._extra, shape: modified },
    }) as ZodObjectBuilder<T>;
  }

  /** Set a catchall schema for unknown keys. */
  catchall(schema: ZodSchemaBuilder<unknown>): ZodObjectBuilder<T> {
    return this._clone({
      extra: { ...this._extra, catchall: schema.__schemaNode },
    }) as ZodObjectBuilder<T>;
  }
}

/** Node kinds contributed by the object schema. */
export const objectNodeKinds: string[] = ["zod/object"];

/**
 * Namespace fragment for object schema factories.
 */
export interface ZodObjectNamespace {
  /** Create an object schema from a shape of field builders. */
  object(
    shape: ShapeInput,
    errorOrOpts?: string | { error?: string },
  ): ZodObjectBuilder<Record<string, unknown>>;

  /** Create a strict object schema (rejects unknown keys). */
  strictObject(
    shape: ShapeInput,
    errorOrOpts?: string | { error?: string },
  ): ZodObjectBuilder<Record<string, unknown>>;

  /** Create a loose object schema (passes unknown keys through). */
  looseObject(
    shape: ShapeInput,
    errorOrOpts?: string | { error?: string },
  ): ZodObjectBuilder<Record<string, unknown>>;
}

/** Build the object namespace factory methods. */
export function objectNamespace(
  ctx: PluginContext,
  parseError: (errorOrOpts?: string | { error?: string }) => string | undefined,
): ZodObjectNamespace {
  return {
    object(
      shape: ShapeInput,
      errorOrOpts?: string | { error?: string },
    ): ZodObjectBuilder<Record<string, unknown>> {
      return new ZodObjectBuilder(ctx, [], [], parseError(errorOrOpts), {
        shape: shapeToAST(shape),
        mode: "strip",
      });
    },

    strictObject(
      shape: ShapeInput,
      errorOrOpts?: string | { error?: string },
    ): ZodObjectBuilder<Record<string, unknown>> {
      return new ZodObjectBuilder(ctx, [], [], parseError(errorOrOpts), {
        shape: shapeToAST(shape),
        mode: "strict",
      });
    },

    looseObject(
      shape: ShapeInput,
      errorOrOpts?: string | { error?: string },
    ): ZodObjectBuilder<Record<string, unknown>> {
      return new ZodObjectBuilder(ctx, [], [], parseError(errorOrOpts), {
        shape: shapeToAST(shape),
        mode: "loose",
      });
    },
  };
}

/**
 * Build a Zod schema from a field's AST node by delegating to the
 * interpreter's buildSchemaGen. This is passed in at registration time
 * to avoid circular imports.
 */
type SchemaBuildFn = (node: any) => AsyncGenerator<TypedNode, z.ZodType, unknown>;

/** Create object interpreter handlers with access to the shared schema builder. */
export function createObjectInterpreter(buildSchema: SchemaBuildFn): SchemaInterpreterMap {
  return {
    "zod/object": async function* (node: any): AsyncGenerator<TypedNode, z.ZodType, unknown> {
      const shape = (node.shape as Record<string, any>) ?? {};
      const mode = (node.mode as string) ?? "strip";
      const errorFn = toZodError(node.error as ErrorConfig | undefined);
      const errOpt = errorFn ? { error: errorFn } : {};

      // Build each shape field's schema recursively
      const builtShape: Record<string, z.ZodType> = {};
      for (const [key, fieldNode] of Object.entries(shape)) {
        builtShape[key] = yield* buildSchema(fieldNode);
      }

      // Create object based on mode
      let obj: z.ZodType;
      switch (mode) {
        case "strict":
          obj = z.strictObject(builtShape, errOpt);
          break;
        case "loose":
          obj = z.looseObject(builtShape, errOpt);
          break;
        default:
          obj = z.object(builtShape, errOpt);
      }

      // Apply catchall if present
      if (node.catchall) {
        const catchallSchema = yield* buildSchema(node.catchall as any);
        obj = (obj as z.ZodObject).catchall(catchallSchema);
      }

      return obj;
    },
  };
}
