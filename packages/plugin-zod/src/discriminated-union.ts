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
  discriminatedUnion<T extends unknown[]>(
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
    discriminatedUnion<T extends unknown[]>(
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
  discriminator?: string;
  options?: AnyZodSchemaNode[];
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
      if (!discriminator) {
        throw new Error("Discriminated union requires a discriminator key");
      }
      const optionNodes = node.options ?? [];
      if (optionNodes.length < 2) {
        throw new Error("Discriminated union requires at least 2 options");
      }
      const errorFn = toZodError(node.error as ErrorConfig | undefined);
      const errOpt = errorFn ? { error: errorFn } : {};
      const builtOptions: z.ZodType[] = [];
      for (const optNode of optionNodes) {
        builtOptions.push(yield* buildSchema(optNode));
      }
      return z.discriminatedUnion(discriminator, builtOptions as never, errOpt);
    },
  };
}
