import type { ASTNode, InterpreterFragment, StepEffect } from "@mvfm/core";
import { z } from "zod";
import type { CheckDescriptor, ErrorConfig } from "./types";

/**
 * Convert an ErrorConfig (string or ASTNode) to a Zod-compatible error function.
 * String errors become a function that returns the string for all issues.
 * ASTNode errors would need interpreter context to evaluate — stored as descriptive string.
 */
function toZodError(error: ErrorConfig | undefined): ((iss: unknown) => string) | undefined {
  if (error === undefined) return undefined;
  if (typeof error === "string") return () => error;
  // ASTNode error config — would need interpreter context to evaluate.
  return () => `[dynamic error: ${JSON.stringify(error)}]`;
}

/**
 * Build check-level error option for Zod check methods.
 * Returns `{ error: fn }` if error is present, otherwise empty object.
 */
function checkErrorOpt(check: CheckDescriptor): { error?: (iss: unknown) => string } {
  const fn = toZodError(check.error as ErrorConfig | undefined);
  return fn ? { error: fn } : {};
}

/**
 * Apply check descriptors to a Zod string schema.
 * Each check kind maps to the corresponding Zod method.
 */
function applyStringChecks(schema: z.ZodString, checks: CheckDescriptor[]): z.ZodString {
  let s = schema;
  for (const check of checks) {
    const errOpt = checkErrorOpt(check);
    switch (check.kind) {
      case "min_length":
        s = s.min(check.value as number, errOpt);
        break;
      case "max_length":
        s = s.max(check.value as number, errOpt);
        break;
      // Additional string checks will be added by #137
      default:
        throw new Error(`Zod interpreter: unknown string check "${check.kind}"`);
    }
  }
  return s;
}

/**
 * Build a Zod schema from a schema AST node (generator version).
 * Yields recurse effects for value-carrying wrappers (default, prefault, catch).
 * Simple schema types and non-value wrappers are handled synchronously.
 */
function* buildSchemaGen(node: ASTNode): Generator<StepEffect, z.ZodType, unknown> {
  switch (node.kind) {
    case "zod/string": {
      const checks = (node.checks as CheckDescriptor[]) ?? [];
      const errorFn = toZodError(node.error as ErrorConfig | undefined);
      const base = errorFn ? z.string({ error: errorFn }) : z.string();
      return applyStringChecks(base, checks);
    }

    // Simple wrappers (no value field)
    case "zod/optional":
      return (yield* buildSchemaGen(node.inner as ASTNode)).optional();
    case "zod/nullable":
      return (yield* buildSchemaGen(node.inner as ASTNode)).nullable();
    case "zod/nullish":
      return (yield* buildSchemaGen(node.inner as ASTNode)).nullish();
    case "zod/nonoptional":
      return (yield* buildSchemaGen(node.inner as ASTNode) as any).nonoptional();
    case "zod/readonly":
      return (yield* buildSchemaGen(node.inner as ASTNode)).readonly();
    case "zod/branded":
      return (yield* buildSchemaGen(node.inner as ASTNode)).brand(node.brand as string);

    // Value-carrying wrappers — evaluate the value AST node via recurse
    case "zod/default": {
      const inner = yield* buildSchemaGen(node.inner as ASTNode);
      const value = yield { type: "recurse", child: node.value as ASTNode };
      return inner.default(value);
    }
    case "zod/prefault": {
      const inner = yield* buildSchemaGen(node.inner as ASTNode);
      const value = yield { type: "recurse", child: node.value as ASTNode };
      return (inner as any).prefault(value);
    }
    case "zod/catch": {
      const inner = yield* buildSchemaGen(node.inner as ASTNode);
      const value = yield { type: "recurse", child: node.value as ASTNode };
      return inner.catch(value);
    }

    // Additional schema types will be added by colocated interpreter issues
    default:
      throw new Error(`Zod interpreter: unknown schema kind "${node.kind}"`);
  }
}

/**
 * Build parse-level error option from the parseError field on validation nodes.
 * In Zod v4, parse-level errors must be functions.
 */
function parseErrorOpt(node: ASTNode): { error?: (iss: unknown) => string } {
  const fn = toZodError(node.parseError as ErrorConfig | undefined);
  return fn ? { error: fn } : {};
}

/**
 * Interpreter fragment for `zod/` node kinds.
 *
 * Handles parsing operation nodes by recursing into schema + input,
 * reconstructing the Zod schema from AST, and executing validation.
 *
 * Schema nodes (zod/string, etc.) are handled by `buildSchemaGen` which
 * constructs actual Zod schemas from AST descriptors, yielding recurse
 * effects for value-carrying wrappers.
 */
export const zodInterpreter: InterpreterFragment = {
  pluginName: "zod",
  canHandle: (node) => node.kind.startsWith("zod/"),
  *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
    switch (node.kind) {
      case "zod/parse": {
        const schema = yield* buildSchemaGen(node.schema as ASTNode);
        const input = yield { type: "recurse", child: node.input as ASTNode };
        return schema.parse(input, parseErrorOpt(node));
      }
      case "zod/safe_parse": {
        const schema = yield* buildSchemaGen(node.schema as ASTNode);
        const input = yield { type: "recurse", child: node.input as ASTNode };
        return schema.safeParse(input, parseErrorOpt(node));
      }
      case "zod/parse_async": {
        const schema = yield* buildSchemaGen(node.schema as ASTNode);
        const input = yield { type: "recurse", child: node.input as ASTNode };
        return schema.parseAsync(input, parseErrorOpt(node));
      }
      case "zod/safe_parse_async": {
        const schema = yield* buildSchemaGen(node.schema as ASTNode);
        const input = yield { type: "recurse", child: node.input as ASTNode };
        return schema.safeParseAsync(input, parseErrorOpt(node));
      }
      default:
        throw new Error(`Zod interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
