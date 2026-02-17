import type { PluginContext, TypedNode } from "@mvfm/core";
import { z } from "zod";
import { ZodSchemaBuilder } from "./base";
import type { SchemaInterpreterMap } from "./interpreter-utils";
import type {
  AnyZodSchemaNode,
  CheckDescriptor,
  ErrorConfig,
  RefinementDescriptor,
  ZodSchemaNodeBase,
} from "./types";

interface ZodLazyNode extends ZodSchemaNodeBase {
  kind: "zod/lazy";
  lazyId: string;
  target?: AnyZodSchemaNode;
  checks: CheckDescriptor[];
  refinements: RefinementDescriptor[];
}

interface ZodLazyRefNode extends ZodSchemaNodeBase {
  kind: "zod/lazy_ref";
  lazyId: string;
}

/**
 * Builder for Zod lazy schemas.
 *
 * Lazy schemas use a getter function to delay evaluation, allowing
 * self-referential and mutually recursive schemas. The AST stores
 * the getter function (not the resolved schema) to avoid infinite nesting.
 *
 * @typeParam T - The output type this schema validates to
 */
export class ZodLazyBuilder<T> extends ZodSchemaBuilder<T> {
  private readonly _lazyId: string;

  constructor(
    ctx: PluginContext,
    lazyId: string,
    checks: readonly CheckDescriptor[] = [],
    refinements: readonly RefinementDescriptor[] = [],
    error?: ErrorConfig,
    extra: Record<string, unknown> = {},
  ) {
    super(ctx, "zod/lazy", checks, refinements, error, extra);
    this._lazyId = lazyId;
  }

  protected _clone(overrides?: {
    checks?: readonly CheckDescriptor[];
    refinements?: readonly RefinementDescriptor[];
    error?: string | TypedNode;
    extra?: Record<string, unknown>;
  }): ZodLazyBuilder<T> {
    return new ZodLazyBuilder<T>(
      this._ctx,
      this._lazyId,
      overrides?.checks ?? this._checks,
      overrides?.refinements ?? this._refinements,
      overrides?.error ?? this._error,
      overrides?.extra ?? { ...this._extra },
    );
  }

  protected _buildSchemaNode(): ZodLazyNode {
    return {
      kind: "zod/lazy",
      lazyId: this._lazyId,
      checks: [...this._checks],
      refinements: [...this._refinements],
      ...(this._error !== undefined ? { error: this._error } : {}),
    };
  }
}

/** Node kinds contributed by the lazy schema. */
export const lazyNodeKinds: string[] = ["zod/lazy", "zod/lazy_ref"];

/**
 * Namespace fragment for lazy schema factory.
 */
export interface ZodLazyNamespace {
  /** Create a lazy schema that resolves via a getter function. */
  lazy<T>(getter: () => ZodSchemaBuilder<T>): ZodLazyBuilder<T>;
}

type LazyRegistry = Map<string, () => ZodSchemaBuilder<unknown>>;

const LAZY_REGISTRY_KEY = "__zodLazyRegistry";
const LAZY_RESOLVER_KEY = "__zodResolveLazySchema";

function getLazyRegistry(ctx: PluginContext): LazyRegistry {
  const bag = ctx as PluginContext & { [LAZY_REGISTRY_KEY]?: LazyRegistry };
  if (!bag[LAZY_REGISTRY_KEY]) {
    bag[LAZY_REGISTRY_KEY] = new Map<string, () => ZodSchemaBuilder<unknown>>();
  }
  return bag[LAZY_REGISTRY_KEY];
}

function resolveLazySchemaNode(
  node: AnyZodSchemaNode,
  registry: LazyRegistry,
  resolving: Set<string> = new Set(),
): AnyZodSchemaNode {
  if (!node || typeof node !== "object") {
    return node;
  }

  if (Array.isArray(node)) {
    return node.map((entry) =>
      typeof entry === "object" && entry !== null
        ? resolveLazySchemaNode(entry as AnyZodSchemaNode, registry, resolving)
        : entry,
    ) as unknown as AnyZodSchemaNode;
  }

  if (node.kind === "zod/lazy") {
    const lazyNode = node as ZodLazyNode;
    if (lazyNode.target) {
      return {
        ...lazyNode,
        target: resolveLazySchemaNode(lazyNode.target, registry, resolving),
      };
    }

    const getter = registry.get(lazyNode.lazyId);
    if (!getter) {
      throw new Error(`Lazy schema resolution failed: unknown lazyId "${lazyNode.lazyId}"`);
    }

    if (resolving.has(lazyNode.lazyId)) {
      return { kind: "zod/lazy_ref", lazyId: lazyNode.lazyId };
    }

    resolving.add(lazyNode.lazyId);
    try {
      const target = resolveLazySchemaNode(
        getter().__schemaNode as AnyZodSchemaNode,
        registry,
        resolving,
      );
      return { ...lazyNode, target };
    } finally {
      resolving.delete(lazyNode.lazyId);
    }
  }

  if (node.kind === "zod/lazy_ref") {
    return node;
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (typeof value === "object" && value !== null) {
      out[key] = resolveLazySchemaNode(value as AnyZodSchemaNode, registry, resolving);
    } else {
      out[key] = value;
    }
  }
  return out as AnyZodSchemaNode;
}

/** Build the lazy namespace factory method. */
export function lazyNamespace(ctx: PluginContext): ZodLazyNamespace {
  const registry = getLazyRegistry(ctx);
  const bag = ctx as PluginContext & {
    [LAZY_RESOLVER_KEY]?: (schema: AnyZodSchemaNode) => AnyZodSchemaNode;
  };
  bag[LAZY_RESOLVER_KEY] = (schema: AnyZodSchemaNode) => resolveLazySchemaNode(schema, registry);

  let lazyCounter = 0;
  return {
    lazy<T>(getter: () => ZodSchemaBuilder<T>): ZodLazyBuilder<T> {
      const lazyId = `zod_lazy_${lazyCounter++}`;
      registry.set(lazyId, getter as () => ZodSchemaBuilder<unknown>);
      return new ZodLazyBuilder<T>(ctx, lazyId);
    },
  };
}

/**
 * Build a Zod schema from a lazy node by delegating to the
 * interpreter's buildSchemaGen.
 */
type SchemaBuildFn = (node: AnyZodSchemaNode) => AsyncGenerator<TypedNode, z.ZodType, unknown>;

/** Create lazy interpreter handler with access to the shared schema builder. */
export function createLazyInterpreter(buildSchema: SchemaBuildFn): SchemaInterpreterMap {
  const lazySchemaById = new Map<string, z.ZodLazy<z.ZodType>>();
  const resolvedSchemaById = new Map<string, z.ZodType>();

  return {
    "zod/lazy": async function* (node: ZodLazyNode): AsyncGenerator<TypedNode, z.ZodType, unknown> {
      if (!node.target) {
        throw new Error(
          `Lazy schema resolution failed: missing target for lazyId "${node.lazyId}"`,
        );
      }
      const existing = lazySchemaById.get(node.lazyId);
      if (existing) {
        return existing;
      }

      const lazySchema: z.ZodLazy<z.ZodType> = z.lazy(() => {
        const resolved = resolvedSchemaById.get(node.lazyId);
        if (resolved) {
          return resolved;
        }
        const loopback = lazySchemaById.get(node.lazyId);
        if (loopback) {
          return loopback;
        }
        throw new Error(
          `Lazy schema resolution failed: missing target for lazyId "${node.lazyId}"`,
        );
      });

      lazySchemaById.set(node.lazyId, lazySchema);
      if (!resolvedSchemaById.has(node.lazyId)) {
        const builtSchema = yield* buildSchema(node.target);
        resolvedSchemaById.set(node.lazyId, builtSchema);
      }
      return lazySchema;
    },

    // biome-ignore lint/correctness/useYield: leaf handler returns cached schema directly
    "zod/lazy_ref": async function* (
      node: ZodLazyRefNode,
    ): AsyncGenerator<TypedNode, z.ZodType, unknown> {
      const schema = lazySchemaById.get(node.lazyId);
      if (!schema) {
        throw new Error(`Lazy schema resolution failed: unknown lazyId "${node.lazyId}"`);
      }
      return schema;
    },
  };
}
