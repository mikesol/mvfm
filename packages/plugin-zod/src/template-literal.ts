import type { PluginContext, TypedNode } from "@mvfm/core";
import { z } from "zod";
import { ZodSchemaBuilder } from "./base";
import type { SchemaInterpreterMap } from "./interpreter-utils";
import type {
  CheckDescriptor,
  ErrorConfig,
  RefinementDescriptor,
  ZodSchemaNodeBase,
} from "./types";

interface ZodTemplateLiteralNode extends ZodSchemaNodeBase {
  kind: "zod/template_literal";
  parts: (string | TypedNode)[];
}

/**
 * Builder for Zod template literal schemas.
 *
 * Validates strings that match a template literal pattern with
 * static and dynamic parts. Dynamic parts can be other schemas
 * (string, number, enum, etc.).
 *
 * @typeParam T - The template literal type produced (e.g., `hello, ${string}!`)
 */
export class ZodTemplateLiteralBuilder<T extends string> extends ZodSchemaBuilder<T> {
  constructor(
    ctx: PluginContext,
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super(ctx, "zod/template_literal", checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: string | TypedNode;
    extra?: Record<string, unknown>;
  }): ZodTemplateLiteralBuilder<T> {
    return new ZodTemplateLiteralBuilder<T>(
      this._ctx,
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }
}

/** Node kinds contributed by template literal schemas. */
export const templateLiteralNodeKinds: string[] = ["zod/template_literal"];

/**
 * Namespace fragment for template literal schema factory.
 */
export interface ZodTemplateLiteralNamespace {
  /**
   * Create a template literal schema.
   *
   * Accepts an array of static strings and dynamic schema parts.
   * Example: `$.zod.templateLiteral(["hello, ", $.zod.string(), "!"])`
   * produces type `hello, ${string}!`
   */
  templateLiteral<T extends string>(
    parts: (string | ZodSchemaBuilder<unknown>)[],
    errorOrOpts?: string | { error?: string },
  ): ZodTemplateLiteralBuilder<T>;
}

/** Build the template literal namespace factory method. */
export function templateLiteralNamespace(
  ctx: PluginContext,
  parseError: (errorOrOpts?: string | { error?: string }) => string | undefined,
): ZodTemplateLiteralNamespace {
  return {
    templateLiteral<T extends string>(
      parts: (string | ZodSchemaBuilder<unknown>)[],
      errorOrOpts?: string | { error?: string },
    ): ZodTemplateLiteralBuilder<T> {
      const nodeParts = parts.map((part) => (typeof part === "string" ? part : part.__schemaNode));
      return new ZodTemplateLiteralBuilder<T>(ctx, [], [], parseError(errorOrOpts), {
        parts: nodeParts,
      });
    },
  };
}

/**
 * Build a Zod schema from a part's AST node by delegating to the
 * interpreter's buildSchemaGen.
 */
type SchemaBuildFn = (node: ZodSchemaNodeBase) => AsyncGenerator<TypedNode, z.ZodType, unknown>;

/** Create template literal interpreter handlers with access to the shared schema builder. */
export function createTemplateLiteralInterpreter(buildSchema: SchemaBuildFn): SchemaInterpreterMap {
  return {
    "zod/template_literal": async function* (
      node: ZodTemplateLiteralNode,
    ): AsyncGenerator<TypedNode, z.ZodType, unknown> {
      const { parts, error } = node;
      const errorMsg = typeof error === "string" ? error : undefined;

      // Build template parts - alternate between static strings and schemas
      const builtParts: (string | number | boolean | null | undefined | z.ZodType)[] = [];
      for (const part of parts as (
        | string
        | number
        | boolean
        | null
        | undefined
        | ZodSchemaNodeBase
      )[]) {
        if (
          typeof part === "string" ||
          typeof part === "number" ||
          typeof part === "boolean" ||
          part === null ||
          part === undefined
        ) {
          builtParts.push(part);
        } else {
          // Recursively build schema for dynamic parts
          const schema = yield* buildSchema(part);
          builtParts.push(schema);
        }
      }

      return z.templateLiteral(builtParts as any, errorMsg);
    },
  };
}
