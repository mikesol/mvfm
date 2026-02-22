// ============================================================
// Zod Plugin AST Types
// ============================================================

/**
 * Error configuration accepted by schema constructors, check methods,
 * and parse operations. Can be a simple string message or a CExpr/unknown
 * value producing a string from the validation issue.
 */
export type ErrorConfig = string | unknown;

/**
 * A check descriptor stored inside a schema node's `checks` array.
 *
 * Each check has a `kind` (e.g. `"min_length"`, `"gt"`, `"regex"`)
 * plus check-specific parameters and optional error/abort/when config.
 */
export interface CheckDescriptor {
  /** Check kind identifier (e.g. `"min_length"`, `"gt"`, `"regex"`) */
  kind: string;
  /** Optional custom error message or error map */
  error?: ErrorConfig;
  /** If true, validation stops after this check fails */
  abort?: boolean;
  /** Conditional execution predicate */
  when?: unknown;
  /** Check-specific parameters (value, pattern, etc.) */
  [key: string]: unknown;
}

/**
 * A refinement node stored in a schema node's `refinements` array.
 *
 * Unlike checks (which are declarative descriptors), refinements carry
 * a predicate expression that uses mvfm DSL operations.
 */
export interface RefinementDescriptor {
  /** Refinement type */
  kind: "refine" | "super_refine" | "check" | "overwrite";
  /** Predicate or transform expression (lambda descriptor with param/body) */
  fn: unknown;
  /** Optional custom error */
  error?: ErrorConfig;
  /** If true, validation stops after this refinement fails */
  abort?: boolean;
  /** Error path override */
  path?: string[];
  /** Conditional execution predicate */
  when?: unknown;
}

/**
 * The descriptor representing a Zod schema definition.
 *
 * Every Zod schema (string, number, object, etc.) produces one of these.
 * The `kind` is namespaced to the plugin (e.g. `"zod/string"`, `"zod/number"`).
 */
export interface SchemaASTNode {
  /** Schema kind (e.g. `"zod/string"`, `"zod/number"`, `"zod/object"`) */
  kind: string;
  /** Accumulated check descriptors */
  checks: CheckDescriptor[];
  /** Accumulated refinement descriptors */
  refinements: RefinementDescriptor[];
  /** Schema-level error config */
  error?: ErrorConfig;
  /** Additional kind-specific payload */
  [key: string]: unknown;
}

/**
 * A wrapper descriptor that wraps an inner schema (e.g. optional, nullable).
 */
export interface WrapperASTNode {
  /** Wrapper kind (e.g. `"zod/optional"`, `"zod/nullable"`) */
  kind: string;
  /** The inner schema being wrapped */
  inner: SchemaASTNode | WrapperASTNode;
  /** Wrappers may carry additional kind-specific properties (fn, target, value, etc.) */
  [key: string]: unknown;
}

/**
 * A validation operation descriptor (parse, safeParse).
 */
export interface ValidationASTNode {
  /** Operation kind (`"zod/parse"` or `"zod/safe_parse"`) */
  kind: "zod/parse" | "zod/safe_parse" | "zod/parse_async" | "zod/safe_parse_async";
  /** The schema to validate against */
  schema: SchemaASTNode | WrapperASTNode;
  /** The input expression to validate */
  input: unknown;
  /** Optional per-parse error config */
  parseError?: ErrorConfig;
}

/**
 * Shared schema node base used by zod interpreter handlers.
 */
export interface ZodSchemaNodeBase {
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
 * Lambda descriptor shape used by preprocess/transform/refinement helpers.
 * In the new system, param and body are CExpr references (or __ref placeholders
 * after extractCExprs serialization).
 */
export interface ZodLambdaNode {
  param: unknown;
  body: unknown;
}

/**
 * Union of schema nodes accepted by the zod interpreter.
 */
export type AnyZodSchemaNode = ZodSchemaNodeBase;
