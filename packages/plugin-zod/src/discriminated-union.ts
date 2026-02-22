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

export class ZodDiscriminatedUnionBuilder<T> extends ZodSchemaBuilder<T> {
  constructor(
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super("zod/discriminated_union", checks, refinements, error, extra);
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: ErrorConfig;
    extra?: Record<string, unknown>;
  }): ZodDiscriminatedUnionBuilder<T> {
    return new ZodDiscriminatedUnionBuilder<T>(
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

/** Build the discriminated union namespace factory methods. */
export function discriminatedUnionNamespace(
  parseError: (errorOrOpts?: string | { error?: string }) => string | undefined,
) {
  return {
    discriminatedUnion: <T extends [unknown, unknown, ...unknown[]]>(
      discriminator: string,
      options: { [K in keyof T]: ZodSchemaBuilder<T[K]> },
      e?: string | { error?: string },
    ) =>
      new ZodDiscriminatedUnionBuilder<T[number]>([], [], parseError(e), {
        discriminator,
        options: optionsToAST(options as ZodSchemaBuilder<unknown>[]),
      }),
  };
}

type SchemaBuildFn = (node: AnyZodSchemaNode) => AsyncGenerator<unknown, z.ZodType, unknown>;

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

function assertOptionNodeShape(node: AnyZodSchemaNode, idx: number, discriminator: string): void {
  if (node.kind !== "zod/object") {
    throw new Error(`Discriminated union option[${idx}] must be a zod/object schema`);
  }
  const shape = (node as { shape?: Record<string, AnyZodSchemaNode> }).shape ?? {};
  const discNode = shape[discriminator];
  if (!discNode) {
    throw new Error(
      `Discriminated union option[${idx}] is missing discriminator "${discriminator}"`,
    );
  }
  const unwrapped = unwrapDiscriminatorSchema(discNode);
  if (
    unwrapped.kind !== "zod/literal" &&
    unwrapped.kind !== "zod/enum" &&
    unwrapped.kind !== "zod/native_enum"
  ) {
    throw new Error(
      `Discriminated union option[${idx}] discriminator "${discriminator}" must be literal or enum-like`,
    );
  }
}

export function createDiscriminatedUnionInterpreter(
  buildSchema: SchemaBuildFn,
): SchemaInterpreterMap {
  return {
    "zod/discriminated_union": async function* (node: ZodDiscriminatedUnionNode) {
      const discriminator = node.discriminator;
      const optionNodes = node.options;
      if (optionNodes.length < 2)
        throw new Error("Discriminated union requires at least 2 options");
      const errorFn = toZodError(node.error as ErrorConfig | undefined);
      const errOpt = errorFn ? { error: errorFn } : {};
      for (const [index, optNode] of optionNodes.entries())
        assertOptionNodeShape(optNode, index, discriminator);
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
