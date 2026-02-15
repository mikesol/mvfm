import type { PluginDefinition } from "@mvfm/core";
import type { ZodArrayNamespace } from "./array";
import { arrayNamespace, arrayNodeKinds } from "./array";
import type { ZodBigIntNamespace } from "./bigint";
import { bigintNamespace, bigintNodeKinds } from "./bigint";
import type { ZodCoerceNamespace } from "./coerce";
import { coerceNamespace, coerceNodeKinds } from "./coerce";
import type { ZodDateNamespace } from "./date";
import { dateNamespace, dateNodeKinds } from "./date";
import type { ZodEnumNamespace } from "./enum";
import { enumNamespace, enumNodeKinds } from "./enum";
import type { ZodIntersectionNamespace } from "./intersection";
import { intersectionNamespace, intersectionNodeKinds } from "./intersection";
import type { ZodLiteralNamespace } from "./literal";
import { literalNamespace, literalNodeKinds } from "./literal";
import type { ZodNumberNamespace } from "./number";
import { numberNamespace, numberNodeKinds } from "./number";
import type { ZodObjectNamespace } from "./object";
import { objectNamespace, objectNodeKinds } from "./object";
import type { ZodPrimitivesNamespace } from "./primitives";
import { primitivesNamespace, primitivesNodeKinds } from "./primitives";
import type { ZodStringNamespace } from "./string";
import { stringNamespace, stringNodeKinds } from "./string";
import type { ZodStringFormatsNamespace } from "./string-formats";
import { stringFormatsNamespace, stringFormatsNodeKinds } from "./string-formats";
import type { ZodTupleNamespace } from "./tuple";
import { tupleNamespace, tupleNodeKinds } from "./tuple";
import type { ZodUnionNamespace } from "./union";
import { unionNamespace, unionNodeKinds } from "./union";

// Re-export types, builders, and interpreter for consumers
export { ZodArrayBuilder } from "./array";
export { ZodSchemaBuilder, ZodWrappedBuilder } from "./base";
export { ZodBigIntBuilder } from "./bigint";
export { ZodDateBuilder } from "./date";
export { ZodEnumBuilder, ZodNativeEnumBuilder } from "./enum";
export { zodInterpreter } from "./interpreter";
export type { SchemaInterpreterMap } from "./interpreter-utils";
export { ZodIntersectionBuilder } from "./intersection";
export { ZodLiteralBuilder } from "./literal";
export { ZodNumberBuilder } from "./number";
export type { ShapeInput } from "./object";
export { ZodObjectBuilder } from "./object";
export { ZodPrimitiveBuilder } from "./primitives";
export { ZodStringBuilder } from "./string";
export type { ZodIsoNamespace, ZodStringFormatsNamespace } from "./string-formats";
export { buildStringFormat } from "./string-formats";
export { ZodTupleBuilder } from "./tuple";
export type {
  CheckDescriptor,
  ErrorConfig,
  RefinementDescriptor,
  SchemaASTNode,
  ValidationASTNode,
  WrapperASTNode,
} from "./types";
export { ZodUnionBuilder } from "./union";

/** Helper to extract error string from the common `errorOrOpts` parameter pattern. */
function parseError(errorOrOpts?: string | { error?: string }): string | undefined {
  return typeof errorOrOpts === "string" ? errorOrOpts : errorOrOpts?.error;
}

/**
 * The `$.zod` namespace contributed by the Zod plugin.
 *
 * Provides factory methods for creating Zod schema builders:
 * `$.zod.string()`, `$.zod.number()`, `$.zod.object(...)`, etc.
 *
 * Each factory returns a schema builder with chainable methods
 * for adding checks, refinements, and wrappers. Call `.parse()`
 * or `.safeParse()` to produce a validation AST node.
 */
export interface ZodNamespace
  extends ZodArrayNamespace,
    ZodStringNamespace,
    ZodBigIntNamespace,
    ZodDateNamespace,
    ZodEnumNamespace,
    ZodIntersectionNamespace,
    ZodLiteralNamespace,
    ZodNumberNamespace,
    ZodObjectNamespace,
    ZodPrimitivesNamespace,
    ZodStringFormatsNamespace,
    ZodTupleNamespace,
    ZodUnionNamespace {
  /** Coercion constructors -- convert input before validating. */
  coerce: ZodCoerceNamespace;
  // ^^^ Each new schema type adds ONE extends clause here
}

/** Parsing and wrapper node kinds shared across all schema types. */
const COMMON_NODE_KINDS: string[] = [
  "zod/parse",
  "zod/safe_parse",
  "zod/parse_async",
  "zod/safe_parse_async",
  "zod/optional",
  "zod/nullable",
  "zod/nullish",
  "zod/nonoptional",
  "zod/default",
  "zod/prefault",
  "zod/catch",
  "zod/readonly",
  "zod/branded",
];

/**
 * Zod validation DSL plugin for mvfm.
 *
 * Adds the `$.zod` namespace to the dollar object, providing factory
 * methods for building Zod-compatible validation schemas as AST nodes.
 * The default interpreter reconstructs actual Zod schemas at runtime.
 *
 * Requires `zod` v4+ as a peer dependency.
 */
export const zod: PluginDefinition<{ zod: ZodNamespace }> = {
  name: "zod",

  nodeKinds: [
    ...COMMON_NODE_KINDS,
    ...arrayNodeKinds,
    ...stringNodeKinds,
    ...bigintNodeKinds,
    ...dateNodeKinds,
    ...enumNodeKinds,
    ...intersectionNodeKinds,
    ...literalNodeKinds,
    ...numberNodeKinds,
    ...objectNodeKinds,
    ...primitivesNodeKinds,
    ...coerceNodeKinds,
    ...stringFormatsNodeKinds,
    ...tupleNodeKinds,
    ...unionNodeKinds,
    // ^^^ Each new schema type adds ONE spread here
  ],

  build(ctx) {
    return {
      zod: {
        ...arrayNamespace(ctx, parseError),
        ...stringNamespace(ctx, parseError),
        ...bigintNamespace(ctx, parseError),
        ...dateNamespace(ctx, parseError),
        ...enumNamespace(ctx, parseError),
        ...intersectionNamespace(ctx, parseError),
        ...literalNamespace(ctx),
        ...numberNamespace(ctx, parseError),
        ...objectNamespace(ctx, parseError),
        ...primitivesNamespace(ctx, parseError),
        ...coerceNamespace(ctx, parseError),
        ...stringFormatsNamespace(ctx, parseError),
        ...tupleNamespace(ctx, parseError),
        ...unionNamespace(ctx, parseError),
        // ^^^ Each new schema type adds ONE spread here
      } as ZodNamespace,
    };
  },
};
