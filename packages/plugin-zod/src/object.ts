import { z } from "zod";
import { ZodSchemaBuilder } from "./base";
import type { SchemaInterpreterMap } from "./interpreter-utils";
import { toZodError } from "./interpreter-utils";
import type {
  AnyZodSchemaNode,
  CheckDescriptor,
  ErrorConfig,
  RefinementDescriptor,
  SchemaASTNode,
  WrapperASTNode,
  ZodSchemaNodeBase,
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
 */
export class ZodObjectBuilder<T extends Record<string, unknown>> extends ZodSchemaBuilder<T> {
  constructor(
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super("zod/object", checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: ErrorConfig;
    extra?: Record<string, unknown>;
  }): ZodObjectBuilder<T> {
    return new ZodObjectBuilder<T>(
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }

  extend(shape: ShapeInput): ZodObjectBuilder<T> {
    const currentShape = (this._extra.shape as Record<string, unknown>) ?? {};
    return this._clone({
      extra: { ...this._extra, shape: { ...currentShape, ...shapeToAST(shape) } },
    }) as ZodObjectBuilder<T>;
  }

  pick(mask: Record<string, true>): ZodObjectBuilder<T> {
    const currentShape = (this._extra.shape as Record<string, unknown>) ?? {};
    const picked: Record<string, unknown> = {};
    for (const key of Object.keys(mask)) {
      if (key in currentShape) picked[key] = currentShape[key];
    }
    return this._clone({ extra: { ...this._extra, shape: picked } }) as ZodObjectBuilder<T>;
  }

  omit(mask: Record<string, true>): ZodObjectBuilder<T> {
    const currentShape = (this._extra.shape as Record<string, unknown>) ?? {};
    const remaining: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(currentShape)) {
      if (!(key in mask)) remaining[key] = val;
    }
    return this._clone({ extra: { ...this._extra, shape: remaining } }) as ZodObjectBuilder<T>;
  }

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
    return this._clone({ extra: { ...this._extra, shape: modified } }) as ZodObjectBuilder<T>;
  }

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
    return this._clone({ extra: { ...this._extra, shape: modified } }) as ZodObjectBuilder<T>;
  }

  catchall(schema: ZodSchemaBuilder<unknown>): ZodObjectBuilder<T> {
    return this._clone({
      extra: { ...this._extra, catchall: schema.__schemaNode },
    }) as ZodObjectBuilder<T>;
  }
}

/** Build the object namespace factory methods. */
export function objectNamespace(
  parseError: (errorOrOpts?: string | { error?: string }) => string | undefined,
) {
  return {
    object(shape: ShapeInput, errorOrOpts?: string | { error?: string }) {
      return new ZodObjectBuilder([], [], parseError(errorOrOpts), {
        shape: shapeToAST(shape),
        mode: "strip",
      });
    },
    strictObject(shape: ShapeInput, errorOrOpts?: string | { error?: string }) {
      return new ZodObjectBuilder([], [], parseError(errorOrOpts), {
        shape: shapeToAST(shape),
        mode: "strict",
      });
    },
    looseObject(shape: ShapeInput, errorOrOpts?: string | { error?: string }) {
      return new ZodObjectBuilder([], [], parseError(errorOrOpts), {
        shape: shapeToAST(shape),
        mode: "loose",
      });
    },
  };
}

type SchemaBuildFn = (node: AnyZodSchemaNode) => AsyncGenerator<unknown, z.ZodType, unknown>;

interface ZodObjectNode extends ZodSchemaNodeBase {
  kind: "zod/object";
  shape?: Record<string, AnyZodSchemaNode>;
  mode?: "strip" | "strict" | "loose";
  catchall?: AnyZodSchemaNode;
}

export function createObjectInterpreter(buildSchema: SchemaBuildFn): SchemaInterpreterMap {
  return {
    "zod/object": async function* (
      node: ZodObjectNode,
    ): AsyncGenerator<unknown, z.ZodType, unknown> {
      const shape = node.shape ?? {};
      const mode = node.mode ?? "strip";
      const errorFn = toZodError(node.error as ErrorConfig | undefined);
      const errOpt = errorFn ? { error: errorFn } : {};
      const builtShape: Record<string, z.ZodType> = {};
      for (const [key, fieldNode] of Object.entries(shape)) {
        builtShape[key] = yield* buildSchema(fieldNode);
      }
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
      if (node.catchall) {
        const catchallSchema = yield* buildSchema(node.catchall);
        obj = (obj as z.ZodObject).catchall(catchallSchema);
      }
      return obj;
    },
  };
}
