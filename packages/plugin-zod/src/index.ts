import type { Interpreter, KindSpec } from "@mvfm/core";

export { z } from "zod";

import type { ZodArrayNamespace } from "./array";
import { arrayNamespace } from "./array";
import type { ZodBigIntNamespace } from "./bigint";
import { bigintNamespace } from "./bigint";
import type { ZodCoerceNamespace } from "./coerce";
import { coerceNamespace } from "./coerce";
import type { ZodDateNamespace } from "./date";
import { dateNamespace } from "./date";
import type { ZodDiscriminatedUnionNamespace } from "./discriminated-union";
import { discriminatedUnionNamespace } from "./discriminated-union";
import type { ZodEnumNamespace } from "./enum";
import { enumNamespace } from "./enum";
import type { ZodFromNamespace } from "./from-zod";
import { fromZodNamespace } from "./from-zod";
import { createZodInterpreter } from "./interpreter";
import type { ZodIntersectionNamespace } from "./intersection";
import { intersectionNamespace } from "./intersection";
import type { ZodLazyNamespace } from "./lazy";
import { lazyNamespace } from "./lazy";
import type { ZodLiteralNamespace } from "./literal";
import { literalNamespace } from "./literal";
import type { ZodMapSetNamespace } from "./map-set";
import { mapSetNamespace } from "./map-set";
import type { ZodNumberNamespace } from "./number";
import { numberNamespace } from "./number";
import type { ZodObjectNamespace } from "./object";
import { objectNamespace } from "./object";
import type { ZodPrimitivesNamespace } from "./primitives";
import { primitivesNamespace } from "./primitives";
import type { ZodRecordNamespace } from "./record";
import { recordNamespace } from "./record";
import type { ZodSpecialNamespace } from "./special";
import { specialNamespace } from "./special";
import type { ZodStringNamespace } from "./string";
import { stringNamespace } from "./string";
import type { ZodStringFormatsNamespace } from "./string-formats";
import { stringFormatsNamespace } from "./string-formats";
import type { ZodStringboolNamespace } from "./stringbool";
import { stringboolNamespace } from "./stringbool";
import type { ZodTemplateLiteralNamespace } from "./template-literal";
import { templateLiteralNamespace } from "./template-literal";
import type { ZodTransformNamespace } from "./transform";
import { transformNamespace } from "./transform";
import type { ZodTupleNamespace } from "./tuple";
import { tupleNamespace } from "./tuple";
import type { ZodUnionNamespace } from "./union";
import { unionNamespace } from "./union";

// Re-export types, builders, and interpreter for consumers
export { ZodArrayBuilder } from "./array";
export { ZodSchemaBuilder, ZodWrappedBuilder } from "./base";
export { ZodBigIntBuilder } from "./bigint";
export { ZodDateBuilder } from "./date";
export { ZodDiscriminatedUnionBuilder } from "./discriminated-union";
export { ZodEnumBuilder, ZodNativeEnumBuilder } from "./enum";
export type { ZodFromOptions } from "./from-zod";
export { createZodInterpreter } from "./interpreter";
export type { SchemaInterpreterMap } from "./interpreter-utils";
export { ZodIntersectionBuilder } from "./intersection";
export { ZodLazyBuilder } from "./lazy";
export { ZodLiteralBuilder } from "./literal";
export { ZodMapBuilder, ZodSetBuilder } from "./map-set";
export { ZodNumberBuilder } from "./number";
export type { ShapeInput } from "./object";
export { ZodObjectBuilder } from "./object";
export { ZodPrimitiveBuilder } from "./primitives";
export { ZodRecordBuilder } from "./record";
export { ZodSimpleBuilder } from "./special";
export { ZodStringBuilder } from "./string";
export type { ZodIsoNamespace, ZodStringFormatsNamespace } from "./string-formats";
export { buildStringFormat } from "./string-formats";
export { ZodStringboolBuilder } from "./stringbool";
export { ZodTemplateLiteralBuilder } from "./template-literal";
export { ZodTransformBuilder } from "./transform";
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
    ZodDiscriminatedUnionNamespace,
    ZodEnumNamespace,
    ZodIntersectionNamespace,
    ZodLazyNamespace,
    ZodLiteralNamespace,
    ZodMapSetNamespace,
    ZodNumberNamespace,
    ZodObjectNamespace,
    ZodPrimitivesNamespace,
    ZodRecordNamespace,
    ZodSpecialNamespace,
    ZodStringboolNamespace,
    ZodStringFormatsNamespace,
    ZodTemplateLiteralNamespace,
    ZodTransformNamespace,
    ZodTupleNamespace,
    ZodUnionNamespace,
    ZodFromNamespace {
  /** Coercion constructors -- convert input before validating. */
  coerce: ZodCoerceNamespace;
  // ^^^ Each new schema type adds ONE extends clause here
}

/** Safe-parse result shape. */
type SafeParseResult = { success: boolean; data?: unknown; error?: unknown };

/**
 * Zod validation DSL plugin for mvfm (unified Plugin type).
 *
 * Adds the `$.zod` namespace to the dollar object, providing factory
 * methods for building Zod-compatible validation schemas as AST nodes.
 * The default interpreter reconstructs actual Zod schemas at runtime.
 *
 * Requires `zod` v4+ as a peer dependency.
 */
export function zod() {
  return {
    name: "zod" as const,
    ctors: {
      zod: {
        ...arrayNamespace(parseError),
        ...stringNamespace(parseError),
        ...bigintNamespace(parseError),
        ...dateNamespace(parseError),
        ...discriminatedUnionNamespace(parseError),
        ...enumNamespace(parseError),
        ...fromZodNamespace(),
        ...intersectionNamespace(parseError),
        ...lazyNamespace(),
        ...literalNamespace(),
        ...mapSetNamespace(parseError),
        ...numberNamespace(parseError),
        ...objectNamespace(parseError),
        ...primitivesNamespace(parseError),
        ...coerceNamespace(parseError),
        ...recordNamespace(parseError),
        ...specialNamespace(parseError),
        ...stringboolNamespace(),
        ...stringFormatsNamespace(parseError),
        ...templateLiteralNamespace(),
        ...transformNamespace(),
        ...tupleNamespace(parseError),
        ...unionNamespace(parseError),
        // ^^^ Each new schema type adds ONE spread here
      } as ZodNamespace,
    },
    kinds: {
      "zod/parse": {
        inputs: [undefined, undefined] as [unknown, unknown],
        output: undefined as unknown,
      } as KindSpec<[unknown, unknown], unknown>,
      "zod/safe_parse": {
        inputs: [undefined, undefined] as [unknown, unknown],
        output: {} as SafeParseResult,
      } as KindSpec<[unknown, unknown], SafeParseResult>,
      "zod/parse_async": {
        inputs: [undefined, undefined] as [unknown, unknown],
        output: undefined as unknown,
      } as KindSpec<[unknown, unknown], unknown>,
      "zod/safe_parse_async": {
        inputs: [undefined, undefined] as [unknown, unknown],
        output: {} as SafeParseResult,
      } as KindSpec<[unknown, unknown], SafeParseResult>,
    },
    traits: {},
    lifts: {},
    defaultInterpreter: (): Interpreter => createZodInterpreter(),
  };
}
