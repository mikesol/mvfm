import type { PluginDefinition } from "@mvfm/core";
import { ZodNumberBuilder } from "./number";
import { ZodStringBuilder } from "./string";

// Re-export types, builders, and interpreter for consumers
export { ZodSchemaBuilder, ZodWrappedBuilder } from "./base";
export { zodInterpreter } from "./interpreter";
export { ZodNumberBuilder } from "./number";
export { ZodStringBuilder } from "./string";
export type {
  CheckDescriptor,
  ErrorConfig,
  RefinementDescriptor,
  SchemaASTNode,
  ValidationASTNode,
  WrapperASTNode,
} from "./types";

/**
 * The `$.zod` namespace contributed by the Zod plugin.
 *
 * Provides factory methods for creating Zod schema builders:
 * `$.zod.string()`, `$.zod.number()`, `$.zod.object(...)`, etc.
 *
 * Each factory returns a schema builder with chainable methods
 * for adding checks, refinements, and wrappers. Call `.parse()`
 * or `.safeParse()` to produce a validation AST node.
 *
 * @example
 * ```ts
 * const app = mvfm(num, str, zod);
 * const prog = app(schema, $ => {
 *   const result = $.zod.string().min(5).safeParse($.input.name);
 *   return $.cond(result.success, result.data, $.fail("invalid"));
 * });
 * ```
 */
export interface ZodNamespace {
  /** Create a string schema builder. */
  string(errorOrOpts?: string | { error?: string }): ZodStringBuilder;

  /** Create a number schema builder. */
  number(errorOrOpts?: string | { error?: string }): ZodNumberBuilder;

  /** Create an integer schema builder (safe integer range). */
  int(errorOrOpts?: string | { error?: string }): ZodNumberBuilder;

  /** Create an int32 schema builder. */
  int32(errorOrOpts?: string | { error?: string }): ZodNumberBuilder;

  /** Create an int64 schema builder. */
  int64(errorOrOpts?: string | { error?: string }): ZodNumberBuilder;

  /** Create a uint32 schema builder. */
  uint32(errorOrOpts?: string | { error?: string }): ZodNumberBuilder;

  /** Create a uint64 schema builder. */
  uint64(errorOrOpts?: string | { error?: string }): ZodNumberBuilder;

  /** Create a float32 schema builder. */
  float32(errorOrOpts?: string | { error?: string }): ZodNumberBuilder;

  /** Create a float64 schema builder. */
  float64(errorOrOpts?: string | { error?: string }): ZodNumberBuilder;

  /**
   * Create a NaN schema builder. Produces `zod/nan` AST node.
   * Validates that the input is specifically NaN.
   */
  nan(errorOrOpts?: string | { error?: string }): ZodNumberBuilder;

  // ---- Stubs for future schema types ----
  // Each issue (#103-#120) adds its factory method here.
  // bigint(errorOrOpts?): ZodBigIntBuilder;
  // boolean(errorOrOpts?): ZodBooleanBuilder;
  // object(shape): ZodObjectBuilder;
  // array(element): ZodArrayBuilder;
  // ... etc.
}

/** Parse error config from the standard `errorOrOpts` param. */
function parseError(errorOrOpts?: string | { error?: string }): string | undefined {
  return typeof errorOrOpts === "string" ? errorOrOpts : errorOrOpts?.error;
}

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
    // Parsing operations (#96)
    "zod/parse",
    "zod/safe_parse",
    "zod/parse_async",
    "zod/safe_parse_async",

    // Schema types — each issue adds its kinds here
    "zod/string", // #100
    "zod/number", // #102
    "zod/nan", // #102

    // Wrappers (#99)
    "zod/optional",
    "zod/nullable",
    "zod/nullish",
    "zod/nonoptional",
    "zod/default",
    "zod/prefault",
    "zod/catch",
    "zod/readonly",
    "zod/branded",
  ],

  build(ctx) {
    return {
      zod: {
        string(errorOrOpts?: string | { error?: string }): ZodStringBuilder {
          return new ZodStringBuilder(ctx, [], [], parseError(errorOrOpts));
        },
        number(errorOrOpts?: string | { error?: string }): ZodNumberBuilder {
          return new ZodNumberBuilder(ctx, [], [], parseError(errorOrOpts));
        },
        int(errorOrOpts?: string | { error?: string }): ZodNumberBuilder {
          return new ZodNumberBuilder(ctx, [], [], parseError(errorOrOpts), { variant: "int" });
        },
        int32(errorOrOpts?: string | { error?: string }): ZodNumberBuilder {
          return new ZodNumberBuilder(ctx, [], [], parseError(errorOrOpts), { variant: "int32" });
        },
        int64(errorOrOpts?: string | { error?: string }): ZodNumberBuilder {
          return new ZodNumberBuilder(ctx, [], [], parseError(errorOrOpts), { variant: "int64" });
        },
        uint32(errorOrOpts?: string | { error?: string }): ZodNumberBuilder {
          return new ZodNumberBuilder(ctx, [], [], parseError(errorOrOpts), { variant: "uint32" });
        },
        uint64(errorOrOpts?: string | { error?: string }): ZodNumberBuilder {
          return new ZodNumberBuilder(ctx, [], [], parseError(errorOrOpts), { variant: "uint64" });
        },
        float32(errorOrOpts?: string | { error?: string }): ZodNumberBuilder {
          return new ZodNumberBuilder(ctx, [], [], parseError(errorOrOpts), {
            variant: "float32",
          });
        },
        float64(errorOrOpts?: string | { error?: string }): ZodNumberBuilder {
          return new ZodNumberBuilder(ctx, [], [], parseError(errorOrOpts), {
            variant: "float64",
          });
        },
        nan(errorOrOpts?: string | { error?: string }): ZodNumberBuilder {
          return new ZodNumberBuilder(ctx, [], [], parseError(errorOrOpts), {}, "zod/nan");
        },
      },
    };
  },
};
