import type { TypedNode } from "@mvfm/core";

// ============================================================
// Zod Plugin AST Types
// ============================================================

/**
 * Error configuration accepted by schema constructors, check methods,
 * and parse operations. Can be a simple string message or an error map
 * AST node (a DSL expression producing a string from the validation issue).
 */
export type ErrorConfig = string | TypedNode;

/**
 * A check descriptor stored inside a schema node's `checks` array.
 *
 * Each check has a `kind` (e.g. `"min_length"`, `"gt"`, `"regex"`)
 * plus check-specific parameters and optional error/abort/when config.
 */
export interface CheckDescriptor {
  /** Check kind identifier (e.g. `"min_length"`, `"gt"`, `"regex"`) */
  kind: string;
  /** Optional custom error message or error map AST node */
  error?: ErrorConfig;
  /** If true, validation stops after this check fails */
  abort?: boolean;
  /** Conditional execution predicate (AST node returning boolean) */
  when?: TypedNode;
  /** Check-specific parameters (value, pattern, etc.) */
  [key: string]: unknown;
}

/**
 * A refinement node stored in a schema node's `refinements` array.
 *
 * Unlike checks (which are declarative descriptors), refinements carry
 * a predicate AST expression that uses mvfm DSL operations.
 */
export interface RefinementDescriptor {
  /** Refinement type */
  kind: "refine" | "super_refine" | "check" | "overwrite";
  /** Predicate or transform AST expression */
  fn: TypedNode;
  /** Optional custom error */
  error?: ErrorConfig;
  /** If true, validation stops after this refinement fails */
  abort?: boolean;
  /** Error path override */
  path?: string[];
  /** Conditional execution predicate */
  when?: TypedNode;
}

/**
 * The AST node representing a Zod schema definition.
 *
 * Every Zod schema (string, number, object, etc.) produces one of these.
 * The `kind` is namespaced to the plugin (e.g. `"zod/string"`, `"zod/number"`).
 */
export interface SchemaASTNode extends TypedNode {
  /** Schema kind (e.g. `"zod/string"`, `"zod/number"`, `"zod/object"`) */
  kind: string;
  /** Accumulated check descriptors */
  checks: CheckDescriptor[];
  /** Accumulated refinement descriptors */
  refinements: RefinementDescriptor[];
  /** Schema-level error config */
  error?: ErrorConfig;
}

/**
 * A wrapper AST node that wraps an inner schema (e.g. optional, nullable).
 */
export interface WrapperASTNode extends TypedNode {
  /** Wrapper kind (e.g. `"zod/optional"`, `"zod/nullable"`) */
  kind: string;
  /** The inner schema being wrapped */
  inner: SchemaASTNode | WrapperASTNode;
  /** Wrappers may carry additional kind-specific properties (fn, target, value, etc.) */
  [key: string]: unknown;
}

/**
 * A validation operation AST node (parse, safeParse).
 */
export interface ValidationASTNode extends TypedNode {
  /** Operation kind (`"zod/parse"` or `"zod/safe_parse"`) */
  kind: "zod/parse" | "zod/safe_parse" | "zod/parse_async" | "zod/safe_parse_async";
  /** The schema to validate against */
  schema: SchemaASTNode | WrapperASTNode;
  /** The input expression to validate */
  input: TypedNode;
  /** Optional per-parse error config */
  parseError?: ErrorConfig;
}

/**
 * Shared schema node base used by zod interpreter handlers.
 */
export interface ZodSchemaNodeBase extends TypedNode {
  /** Schema kind (e.g. `"zod/string"`). */
  kind: string;
  /** Optional check descriptors carried by this node. */
  checks?: CheckDescriptor[];
  /** Optional refinement descriptors carried by this node. */
  refinements?: RefinementDescriptor[];
  /** Optional schema-level error config. */
  error?: ErrorConfig;
  /** Additional kind-specific payload. */
  [key: string]: unknown;
}

/**
 * Lambda AST shape used by preprocess/transform/refinement helpers.
 */
export interface ZodLambdaNode extends TypedNode {
  kind: "core/lambda";
  param: { __id: number; name?: string };
  body: TypedNode;
}

/**
 * Union of schema nodes accepted by the zod interpreter.
 */
export type AnyZodSchemaNode = ZodSchemaNodeBase;
