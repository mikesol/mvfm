import type { PluginContext, TypedNode } from "@mvfm/core";
import { z } from "zod";
import { ZodSchemaBuilder } from "./base";
import type { SchemaInterpreterMap } from "./interpreter-utils";
import type {
  CheckDescriptor,
  ErrorConfig,
  RefinementDescriptor,
  SchemaASTNode,
  WrapperASTNode,
  ZodSchemaNodeBase,
} from "./types";

type TemplatePart = string | SchemaASTNode | WrapperASTNode;

interface ZodTemplateLiteralNode extends ZodSchemaNodeBase {
  kind: "zod/template_literal";
  parts: TemplatePart[];
}

/**
 * Builder for Zod template literal schemas.
 *
 * Template literals validate strings matching a pattern of static
 * and dynamic parts. Dynamic parts are other Zod schemas (string,
 * number, etc.) that match their respective types within the template.
 *
 * @typeParam T - The output type this schema validates to
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

/** Node kinds contributed by the template literal schema. */
export const templateLiteralNodeKinds: string[] = ["zod/template_literal"];

/**
 * Namespace fragment for template literal schema factories.
 */
export interface ZodTemplateLiteralNamespace {
  /**
   * Create a template literal schema.
   *
   * @example
   * ```ts
   * $.zod.templateLiteral(["hello, ", $.zod.string(), "!"])
   * // matches: "hello, world!"
   *
   * $.zod.templateLiteral([$.zod.number(), "px"])
   * // matches: "42px", "3.14px"
   * ```
   */
  templateLiteral<T extends string>(
    parts: (string | ZodSchemaBuilder<unknown>)[],
  ): ZodTemplateLiteralBuilder<T>;
}

/** Build the template literal namespace factory methods. */
export function templateLiteralNamespace(ctx: PluginContext): ZodTemplateLiteralNamespace {
  return {
    templateLiteral<T extends string>(
      parts: (string | ZodSchemaBuilder<unknown>)[],
    ): ZodTemplateLiteralBuilder<T> {
      const astParts: TemplatePart[] = parts.map((p) =>
        typeof p === "string" ? p : p.__schemaNode,
      );
      return new ZodTemplateLiteralBuilder<T>(ctx, [], [], undefined, { parts: astParts });
    },
  };
}

/** Create interpreter handlers for template literal schema nodes. */
export function createTemplateLiteralInterpreter(
  buildSchema: (node: ZodSchemaNodeBase) => AsyncGenerator<TypedNode, z.ZodType, unknown>,
): SchemaInterpreterMap {
  return {
    "zod/template_literal": async function* (
      node: ZodTemplateLiteralNode,
    ): AsyncGenerator<TypedNode, z.ZodType, unknown> {
      const builtParts: (string | z.ZodType)[] = [];
      for (const part of node.parts) {
        if (typeof part === "string") {
          builtParts.push(part);
        } else {
          builtParts.push(yield* buildSchema(part as ZodSchemaNodeBase));
        }
      }
      // Cast needed: Zod's internal $ZodTemplateLiteralPart requires
      // schemas with a `pattern` property, but at runtime any ZodType works.
      return z.templateLiteral(builtParts as Parameters<typeof z.templateLiteral>[0]);
    },
  };
}
