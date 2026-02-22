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

export class ZodTemplateLiteralBuilder<T extends string> extends ZodSchemaBuilder<T> {
  constructor(
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super("zod/template_literal", checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: ErrorConfig;
    extra?: Record<string, unknown>;
  }): ZodTemplateLiteralBuilder<T> {
    return new ZodTemplateLiteralBuilder<T>(
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }
}

/** Build the template literal namespace factory methods. */
export function templateLiteralNamespace() {
  return {
    templateLiteral: <T extends string>(parts: (string | ZodSchemaBuilder<unknown>)[]) => {
      const astParts: TemplatePart[] = parts.map((p) =>
        typeof p === "string" ? p : p.__schemaNode,
      );
      return new ZodTemplateLiteralBuilder<T>([], [], undefined, { parts: astParts });
    },
  };
}

export function createTemplateLiteralInterpreter(
  buildSchema: (node: ZodSchemaNodeBase) => AsyncGenerator<unknown, z.ZodType, unknown>,
): SchemaInterpreterMap {
  return {
    "zod/template_literal": async function* (node: ZodTemplateLiteralNode) {
      const builtParts: (string | z.ZodType)[] = [];
      for (const part of node.parts) {
        if (typeof part === "string") builtParts.push(part);
        else builtParts.push(yield* buildSchema(part as ZodSchemaNodeBase));
      }
      return z.templateLiteral(builtParts as Parameters<typeof z.templateLiteral>[0]);
    },
  };
}
