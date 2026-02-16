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
import { zodXor } from "./zod-compat";

/**
 * Builder for Zod union and exclusive-or (xor) schemas.
 *
 * Stores option schemas as AST nodes in the `options` extra field.
 * Used for both `$.zod.union(...)` and `$.zod.xor(...)`.
 *
 * @typeParam T - The union output type
 */
export class ZodUnionBuilder<T> extends ZodSchemaBuilder<T> {
  constructor(
    ctx: PluginContext,
    kind: "zod/union" | "zod/xor",
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super(ctx, kind, checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: string | TypedNode;
    extra?: Record<string, unknown>;
  }): ZodUnionBuilder<T> {
    return new ZodUnionBuilder<T>(
      this._ctx,
      this._kind as "zod/union" | "zod/xor",
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

/** Node kinds registered by the union schema. */
export const unionNodeKinds: string[] = ["zod/union", "zod/xor"];

/**
 * Namespace fragment for union schema factories.
 */
export interface ZodUnionNamespace {
  /** Create a union schema builder (A | B | ...). */
  union<T extends unknown[]>(
    options: { [K in keyof T]: ZodSchemaBuilder<T[K]> },
    errorOrOpts?: string | { error?: string },
  ): ZodUnionBuilder<T[number]>;

  /** Create an exclusive union schema builder (exactly one must match). */
  xor<T extends unknown[]>(
    options: { [K in keyof T]: ZodSchemaBuilder<T[K]> },
    errorOrOpts?: string | { error?: string },
  ): ZodUnionBuilder<T[number]>;
}

/** Build the union namespace factory methods. */
export function unionNamespace(
  ctx: PluginContext,
  parseError: (errorOrOpts?: string | { error?: string }) => string | undefined,
): ZodUnionNamespace {
  return {
    union<T extends unknown[]>(
      options: { [K in keyof T]: ZodSchemaBuilder<T[K]> },
      errorOrOpts?: string | { error?: string },
    ): ZodUnionBuilder<T[number]> {
      const error = parseError(errorOrOpts);
      return new ZodUnionBuilder<T[number]>(ctx, "zod/union", [], [], error, {
        options: optionsToAST(options as ZodSchemaBuilder<unknown>[]),
      });
    },

    xor<T extends unknown[]>(
      options: { [K in keyof T]: ZodSchemaBuilder<T[K]> },
      errorOrOpts?: string | { error?: string },
    ): ZodUnionBuilder<T[number]> {
      const error = parseError(errorOrOpts);
      return new ZodUnionBuilder<T[number]>(ctx, "zod/xor", [], [], error, {
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

interface ZodUnionNode extends ZodSchemaNodeBase {
  kind: "zod/union";
  options?: AnyZodSchemaNode[];
}

interface ZodXorNode extends ZodSchemaNodeBase {
  kind: "zod/xor";
  options?: AnyZodSchemaNode[];
}

/** Create union interpreter handlers with access to the shared schema builder. */
export function createUnionInterpreter(buildSchema: SchemaBuildFn): SchemaInterpreterMap {
  return {
    "zod/union": async function* (
      node: ZodUnionNode,
    ): AsyncGenerator<TypedNode, z.ZodType, unknown> {
      const optionNodes = node.options ?? [];
      const errorFn = toZodError(node.error as ErrorConfig | undefined);
      const errOpt = errorFn ? { error: errorFn } : {};
      const builtOptions: z.ZodType[] = [];
      for (const optNode of optionNodes) {
        builtOptions.push(yield* buildSchema(optNode));
      }
      return z.union(builtOptions as [z.ZodType, z.ZodType, ...z.ZodType[]], errOpt);
    },

    "zod/xor": async function* (node: ZodXorNode): AsyncGenerator<TypedNode, z.ZodType, unknown> {
      const optionNodes = node.options ?? [];
      const errorFn = toZodError(node.error as ErrorConfig | undefined);
      const errOpt = errorFn ? { error: errorFn } : {};
      const builtOptions: z.ZodType[] = [];
      for (const optNode of optionNodes) {
        builtOptions.push(yield* buildSchema(optNode));
      }
      return zodXor(builtOptions as [z.ZodType, z.ZodType, ...z.ZodType[]], errOpt);
    },
  };
}
