import type { ASTNode } from "@mvfm/core";

// ============================================================
// Zod Plugin AST Types
// ============================================================

/**
 * Error configuration accepted by schema constructors, check methods,
 * and parse operations. Can be a simple string message or an error map
 * AST node (a DSL expression producing a string from the validation issue).
 */
export type ErrorConfig = string | ASTNode;

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
  when?: ASTNode;
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
  fn: ASTNode;
  /** Optional custom error */
  error?: ErrorConfig;
  /** If true, validation stops after this refinement fails */
  abort?: boolean;
  /** Error path override */
  path?: string[];
  /** Conditional execution predicate */
  when?: ASTNode;
}

/**
 * The AST node representing a Zod schema definition.
 *
 * Every Zod schema (string, number, object, etc.) produces one of these.
 * The `kind` is namespaced to the plugin (e.g. `"zod/string"`, `"zod/number"`).
 */
export interface SchemaASTNode extends ASTNode {
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
export interface WrapperASTNode extends ASTNode {
  /** Wrapper kind (e.g. `"zod/optional"`, `"zod/nullable"`) */
  kind: string;
  /** The inner schema being wrapped */
  inner: SchemaASTNode | WrapperASTNode;
}

/**
 * A validation operation AST node (parse, safeParse).
 */
export interface ValidationASTNode extends ASTNode {
  /** Operation kind (`"zod/parse"` or `"zod/safe_parse"`) */
  kind: "zod/parse" | "zod/safe_parse" | "zod/parse_async" | "zod/safe_parse_async";
  /** The schema to validate against */
  schema: SchemaASTNode | WrapperASTNode;
  /** The input expression to validate */
  input: ASTNode;
  /** Optional per-parse error config */
  parseError?: ErrorConfig;
}
