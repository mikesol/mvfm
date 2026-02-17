import type { PluginContext, TypedNode } from "@mvfm/core";
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

/**
 * Builder for Zod discriminated union schemas.
 *
 * Stores discriminator key and option schemas as AST nodes.
 * Used for `$.zod.discriminatedUnion(discriminator, options)`.
 *
 * @typeParam T - The discriminated union output type
 */
export class ZodDiscriminatedUnionBuilder<T> extends ZodSchemaBuilder<T> {
  constructor(
    ctx: PluginContext,
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super(ctx, "zod/discriminated_union", checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: string | TypedNode;
    extra?: Record<string, unknown>;
  }): ZodDiscriminatedUnionBuilder<T> {
    return new ZodDiscriminatedUnionBuilder<T>(
      this._ctx,
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }
}

/** Convert an array of schema builders to an array of AST nodes. */
export function optionsToAST(
  options: ZodSchemaBuilder<unknown>[],
): (SchemaASTNode | WrapperASTNode)[] {
  return options.map((builder) => builder.__schemaNode);
}

/** Node kinds registered by the discriminated union schema. */
export const discriminatedUnionNodeKinds: string[] = ["zod/discriminated_union"];

/**
 * Namespace fragment for discriminated union schema factories.
 */
export interface ZodDiscriminatedUnionNamespace {
  /** Create a discriminated union schema builder. */
  discriminatedUnion<T extends [unknown, unknown, ...unknown[]]>(
    discriminator: string,
    options: { [K in keyof T]: ZodSchemaBuilder<T[K]> },
    errorOrOpts?: string | { error?: string },
  ): ZodDiscriminatedUnionBuilder<T[number]>;
}

/** Build the discriminated union namespace factory methods. */
export function discriminatedUnionNamespace(
  ctx: PluginContext,
  parseError: (errorOrOpts?: string | { error?: string }) => string | undefined,
): ZodDiscriminatedUnionNamespace {
  return {
    discriminatedUnion<T extends [unknown, unknown, ...unknown[]]>(
      discriminator: string,
      options: { [K in keyof T]: ZodSchemaBuilder<T[K]> },
      errorOrOpts?: string | { error?: string },
    ): ZodDiscriminatedUnionBuilder<T[number]> {
      const error = parseError(errorOrOpts);
      return new ZodDiscriminatedUnionBuilder<T[number]>(ctx, [], [], error, {
        discriminator,
        options: optionsToAST(options as ZodSchemaBuilder<unknown>[]),
      });
    },
  };
}

/**
 * Build a Zod schema from a field's AST node by delegating to the
 * interpreter's buildSchemaGen. This is passed in at registration time
 * to avoid circular imports.
 */
type SchemaBuildFn = (node: AnyZodSchemaNode) => AsyncGenerator<TypedNode, z.ZodType, unknown>;

interface ZodDiscriminatedUnionNode extends ZodSchemaNodeBase {
  kind: "zod/discriminated_union";
  discriminator: string;
  options: AnyZodSchemaNode[];
}

const WRAPPER_KINDS = new Set([
  "zod/optional",
  "zod/nullable",
  "zod/nullish",
  "zod/nonoptional",
  "zod/default",
  "zod/prefault",
  "zod/catch",
  "zod/readonly",
  "zod/branded",
]);

function unwrapDiscriminatorSchema(node: AnyZodSchemaNode): AnyZodSchemaNode {
  let current = node;
  while (WRAPPER_KINDS.has(current.kind) && "inner" in current && current.inner) {
    current = current.inner as AnyZodSchemaNode;
  }
  return current;
}

function assertOptionNodeShape(
  node: AnyZodSchemaNode,
  optionIndex: number,
  discriminator: string,
): void {
  if (node.kind !== "zod/object") {
    throw new Error(`Discriminated union option[${optionIndex}] must be a zod/object schema`);
  }

  const shape = (node as { shape?: Record<string, AnyZodSchemaNode> }).shape ?? {};
  const discriminatorNode = shape[discriminator];
  if (!discriminatorNode) {
    throw new Error(
      `Discriminated union option[${optionIndex}] is missing discriminator "${discriminator}"`,
    );
  }

  const unwrapped = unwrapDiscriminatorSchema(discriminatorNode);
  if (
    unwrapped.kind !== "zod/literal" &&
    unwrapped.kind !== "zod/enum" &&
    unwrapped.kind !== "zod/native_enum"
  ) {
    throw new Error(
      `Discriminated union option[${optionIndex}] discriminator "${discriminator}" must be literal or enum-like`,
    );
  }
}

/** Create discriminated union interpreter handlers with access to the shared schema builder. */
export function createDiscriminatedUnionInterpreter(
  buildSchema: SchemaBuildFn,
): SchemaInterpreterMap {
  return {
    "zod/discriminated_union": async function* (
      node: ZodDiscriminatedUnionNode,
    ): AsyncGenerator<TypedNode, z.ZodType, unknown> {
      const discriminator = node.discriminator;
      const optionNodes = node.options;
      if (optionNodes.length < 2) {
        throw new Error("Discriminated union requires at least 2 options");
      }
      const errorFn = toZodError(node.error as ErrorConfig | undefined);
      const errOpt = errorFn ? { error: errorFn } : {};
      for (const [index, optNode] of optionNodes.entries()) {
        assertOptionNodeShape(optNode, index, discriminator);
      }
      const builtOptions: z.ZodObject<any>[] = [];
      for (const [index, optNode] of optionNodes.entries()) {
        const built = yield* buildSchema(optNode);
        if (!(built instanceof z.ZodObject)) {
          throw new Error(`Discriminated union option[${index}] must build to a ZodObject schema`);
        }
        builtOptions.push(built);
      }
      return z.discriminatedUnion(
        discriminator,
        builtOptions as [z.ZodObject<any>, z.ZodObject<any>, ...z.ZodObject<any>[]],
        errOpt,
      );
    },
  };
}
