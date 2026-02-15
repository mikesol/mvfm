import type { ASTNode, InterpreterFragment, StepEffect } from "@mvfm/core";
import { z } from "zod";
import type { CheckDescriptor } from "./types";

/**
 * Apply check descriptors to a Zod string schema.
 * Each check kind maps to the corresponding Zod method.
 */
function applyStringChecks(schema: z.ZodString, checks: CheckDescriptor[]): z.ZodString {
  let s = schema;
  for (const check of checks) {
    switch (check.kind) {
      case "min_length":
        s = s.min(check.value as number);
        break;
      case "max_length":
        s = s.max(check.value as number);
        break;
      // Additional string checks will be added by #137
      default:
        throw new Error(`Zod interpreter: unknown string check "${check.kind}"`);
    }
  }
  return s;
}

/**
 * Build a Zod schema from a schema AST node.
 * Dispatches on node.kind to construct the appropriate Zod type.
 */
function buildSchema(node: ASTNode): z.ZodType {
  switch (node.kind) {
    case "zod/string": {
      const checks = (node.checks as CheckDescriptor[]) ?? [];
      return applyStringChecks(z.string(), checks);
    }
    // Additional schema types will be added by colocated interpreter issues
    default:
      throw new Error(`Zod interpreter: unknown schema kind "${node.kind}"`);
  }
}

/**
 * Interpreter fragment for `zod/` node kinds.
 *
 * Handles parsing operation nodes by recursing into schema + input,
 * reconstructing the Zod schema from AST, and executing validation.
 *
 * Schema nodes (zod/string, etc.) are handled by `buildSchema` which
 * constructs actual Zod schemas from AST descriptors.
 */
export const zodInterpreter: InterpreterFragment = {
  pluginName: "zod",
  canHandle: (node) => node.kind.startsWith("zod/"),
  *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
    switch (node.kind) {
      case "zod/parse": {
        const schema = buildSchema(node.schema as ASTNode);
        const input = yield { type: "recurse", child: node.input as ASTNode };
        return schema.parse(input);
      }
      case "zod/safe_parse": {
        const schema = buildSchema(node.schema as ASTNode);
        const input = yield { type: "recurse", child: node.input as ASTNode };
        return schema.safeParse(input);
      }
      case "zod/parse_async": {
        const schema = buildSchema(node.schema as ASTNode);
        const input = yield { type: "recurse", child: node.input as ASTNode };
        return schema.parseAsync(input);
      }
      case "zod/safe_parse_async": {
        const schema = buildSchema(node.schema as ASTNode);
        const input = yield { type: "recurse", child: node.input as ASTNode };
        return schema.safeParseAsync(input);
      }
      default:
        throw new Error(`Zod interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
