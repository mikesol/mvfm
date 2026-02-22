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

export class ZodUnionBuilder<T> extends ZodSchemaBuilder<T> {
  constructor(
    kind: "zod/union" | "zod/xor",
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super(kind, checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: ErrorConfig;
    extra?: Record<string, unknown>;
  }): ZodUnionBuilder<T> {
    return new ZodUnionBuilder<T>(
      this._kind as "zod/union" | "zod/xor",
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }
}

export function optionsToAST(
  options: ZodSchemaBuilder<unknown>[],
): (SchemaASTNode | WrapperASTNode)[] {
  return options.map((builder) => builder.__schemaNode);
}

/** Build the union namespace factory methods. */
export function unionNamespace(
  parseError: (errorOrOpts?: string | { error?: string }) => string | undefined,
) {
  return {
    union: <T extends unknown[]>(
      options: { [K in keyof T]: ZodSchemaBuilder<T[K]> },
      e?: string | { error?: string },
    ) =>
      new ZodUnionBuilder<T[number]>("zod/union", [], [], parseError(e), {
        options: optionsToAST(options as ZodSchemaBuilder<unknown>[]),
      }),
    xor: <T extends unknown[]>(
      options: { [K in keyof T]: ZodSchemaBuilder<T[K]> },
      e?: string | { error?: string },
    ) =>
      new ZodUnionBuilder<T[number]>("zod/xor", [], [], parseError(e), {
        options: optionsToAST(options as ZodSchemaBuilder<unknown>[]),
      }),
  };
}

type SchemaBuildFn = (node: AnyZodSchemaNode) => AsyncGenerator<unknown, z.ZodType, unknown>;

interface ZodUnionNode extends ZodSchemaNodeBase {
  kind: "zod/union";
  options?: AnyZodSchemaNode[];
}
interface ZodXorNode extends ZodSchemaNodeBase {
  kind: "zod/xor";
  options?: AnyZodSchemaNode[];
}

export function createUnionInterpreter(buildSchema: SchemaBuildFn): SchemaInterpreterMap {
  return {
    "zod/union": async function* (node: ZodUnionNode) {
      const optionNodes = node.options ?? [];
      const errorFn = toZodError(node.error as ErrorConfig | undefined);
      const errOpt = errorFn ? { error: errorFn } : {};
      const builtOptions: z.ZodType[] = [];
      for (const optNode of optionNodes) builtOptions.push(yield* buildSchema(optNode));
      return z.union(builtOptions as [z.ZodType, z.ZodType, ...z.ZodType[]], errOpt);
    },
    "zod/xor": async function* (node: ZodXorNode) {
      const optionNodes = node.options ?? [];
      const errorFn = toZodError(node.error as ErrorConfig | undefined);
      const errOpt = errorFn ? { error: errorFn } : {};
      const builtOptions: z.ZodType[] = [];
      for (const optNode of optionNodes) builtOptions.push(yield* buildSchema(optNode));
      return zodXor(builtOptions as [z.ZodType, z.ZodType, ...z.ZodType[]], errOpt);
    },
  };
}
