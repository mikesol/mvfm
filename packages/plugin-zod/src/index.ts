import type { Interpreter, KindSpec, Plugin } from "@mvfm/core";

export { z } from "zod";

import { arrayNamespace } from "./array";
import { bigintNamespace } from "./bigint";
import { coerceNamespace } from "./coerce";
import { dateNamespace } from "./date";
import { discriminatedUnionNamespace } from "./discriminated-union";
import { enumNamespace } from "./enum";
import { fromZodNamespace } from "./from-zod";
import { createZodInterpreter } from "./interpreter";
import { intersectionNamespace } from "./intersection";
import { lazyNamespace } from "./lazy";
import { literalNamespace } from "./literal";
import { mapSetNamespace } from "./map-set";
import { numberNamespace } from "./number";
import { objectNamespace } from "./object";
import { primitivesNamespace } from "./primitives";
import { recordNamespace } from "./record";
import { specialNamespace } from "./special";
import { stringNamespace } from "./string";
import { stringFormatsNamespace } from "./string-formats";
import { stringboolNamespace } from "./stringbool";
import { templateLiteralNamespace } from "./template-literal";
import { transformNamespace } from "./transform";
import { tupleNamespace } from "./tuple";
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
      },
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
  } satisfies Plugin;
}
