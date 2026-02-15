import type { PluginDefinition } from "@mvfm/core";
import { ZodStringBuilder } from "./string";

// Re-export types and builders for consumers
export { ZodSchemaBuilder } from "./base";
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

  // ---- Stubs for future schema types ----
  // Each issue (#102-#120) adds its factory method here.
  // number(errorOrOpts?): ZodNumberBuilder;
  // bigint(errorOrOpts?): ZodBigIntBuilder;
  // boolean(errorOrOpts?): ZodBooleanBuilder;
  // object(shape): ZodObjectBuilder;
  // array(element): ZodArrayBuilder;
  // ... etc.
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
          const error = typeof errorOrOpts === "string" ? errorOrOpts : errorOrOpts?.error;
          return new ZodStringBuilder(ctx, [], [], error);
        },
      },
    };
  },
};
