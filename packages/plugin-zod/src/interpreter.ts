import type { ASTNode, InterpreterFragment, StepEffect } from "@mvfm/core";
import { injectLambdaParam } from "@mvfm/core";
import type { z } from "zod";
import { createArrayInterpreter } from "./array";
import { bigintInterpreter } from "./bigint";
import { dateInterpreter } from "./date";
import { enumInterpreter } from "./enum";
import type { SchemaInterpreterMap } from "./interpreter-utils";
import { toZodError } from "./interpreter-utils";
import { literalInterpreter } from "./literal";
import { numberInterpreter } from "./number";
import { createObjectInterpreter } from "./object";
import { primitivesInterpreter } from "./primitives";
import { stringInterpreter } from "./string";
import type { ErrorConfig, RefinementDescriptor } from "./types";

// ---- Schema handler dispatch ----
// Each schema module exports an interpreter map.
// New schema types add ONE import + ONE spread here.
// Leaf handlers don't need buildSchemaGen; recursive handlers do.

const leafHandlers: SchemaInterpreterMap = {
  ...stringInterpreter,
  ...bigintInterpreter,
  ...dateInterpreter,
  ...enumInterpreter,
  ...literalInterpreter,
  ...numberInterpreter,
  ...primitivesInterpreter,
};

// Recursive handlers (array, object) need buildSchemaGen for inner schemas.
// Initialized lazily on first use to break the definition-order cycle.
let schemaHandlers: SchemaInterpreterMap | undefined;

/** @internal Resolve all schema handlers, including recursive ones. */
function getHandlers(): SchemaInterpreterMap {
  if (!schemaHandlers) {
    schemaHandlers = {
      ...leafHandlers,
      ...createObjectInterpreter(buildSchemaGen),
      ...createArrayInterpreter(buildSchemaGen),
    };
  }
  return schemaHandlers;
}

/**
 * Build a Zod schema from a schema AST node (generator version).
 * Dispatches to per-schema handlers, then handles shared wrappers.
 */
function* buildSchemaGen(node: ASTNode): Generator<StepEffect, z.ZodType, unknown> {
  // Schema type dispatch
  const handler = getHandlers()[node.kind];
  if (handler) return yield* handler(node);

  // Shared wrappers (stable — never changes per schema type)
  switch (node.kind) {
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
    default:
      throw new Error(`Zod interpreter: unknown schema kind "${node.kind}"`);
  }
}

/**
 * Build parse-level error option from the parseError field on validation nodes.
 */
function parseErrorOpt(node: ASTNode): { error?: (iss: unknown) => string } {
  const fn = toZodError(node.parseError as ErrorConfig | undefined);
  return fn ? { error: fn } : {};
}

/**
 * Extract refinements from a schema AST node.
 */
function extractRefinements(schemaNode: ASTNode): RefinementDescriptor[] {
  return (schemaNode.refinements as RefinementDescriptor[] | undefined) ?? [];
}

/**
 * Apply refinement descriptors to a validated value via the generator pipeline.
 */
function* applyRefinements(
  value: unknown,
  refinements: RefinementDescriptor[],
): Generator<StepEffect, unknown, unknown> {
  let current = value;
  for (const ref of refinements) {
    const lambda = ref.fn as unknown as { param: { name: string }; body: ASTNode };
    const bodyClone = structuredClone(lambda.body);
    injectLambdaParam(bodyClone, lambda.param.name, current);
    const result = yield { type: "recurse", child: bodyClone };

    switch (ref.kind) {
      case "refine":
      case "check":
        if (!result) {
          throw new Error(typeof ref.error === "string" ? ref.error : "Refinement failed");
        }
        break;
      case "overwrite":
        current = result;
        break;
      case "super_refine":
        break;
    }
  }
  return current;
}

/**
 * Interpreter fragment for `zod/` node kinds.
 *
 * Handles parsing operation nodes by recursing into schema + input,
 * reconstructing the Zod schema from AST, and executing validation.
 */
export const zodInterpreter: InterpreterFragment = {
  pluginName: "zod",
  canHandle: (node) => node.kind.startsWith("zod/"),
  *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
    switch (node.kind) {
      case "zod/parse": {
        const schemaNode = node.schema as ASTNode;
        const schema = yield* buildSchemaGen(schemaNode);
        const input = yield { type: "recurse", child: node.input as ASTNode };
        let value = schema.parse(input, parseErrorOpt(node));
        const refinements = extractRefinements(schemaNode);
        if (refinements.length > 0) {
          value = yield* applyRefinements(value, refinements);
        }
        return value;
      }
      case "zod/safe_parse": {
        const schemaNode = node.schema as ASTNode;
        const schema = yield* buildSchemaGen(schemaNode);
        const input = yield { type: "recurse", child: node.input as ASTNode };
        const result = schema.safeParse(input, parseErrorOpt(node));
        if (!result.success) return result;
        const refinements = extractRefinements(schemaNode);
        if (refinements.length > 0) {
          try {
            const refined = yield* applyRefinements(result.data, refinements);
            return { success: true, data: refined };
          } catch (e) {
            return { success: false, error: e };
          }
        }
        return result;
      }
      case "zod/parse_async": {
        const schemaNode = node.schema as ASTNode;
        const schema = yield* buildSchemaGen(schemaNode);
        const input = yield { type: "recurse", child: node.input as ASTNode };
        let value = schema.parse(input, parseErrorOpt(node));
        const refinements = extractRefinements(schemaNode);
        if (refinements.length > 0) {
          value = yield* applyRefinements(value, refinements);
        }
        return value;
      }
      case "zod/safe_parse_async": {
        const schemaNode = node.schema as ASTNode;
        const schema = yield* buildSchemaGen(schemaNode);
        const input = yield { type: "recurse", child: node.input as ASTNode };
        const result = schema.safeParse(input, parseErrorOpt(node));
        if (!result.success) return result;
        const refinements = extractRefinements(schemaNode);
        if (refinements.length > 0) {
          try {
            const refined = yield* applyRefinements(result.data, refinements);
            return { success: true, data: refined };
          } catch (e) {
            return { success: false, error: e };
          }
        }
        return result;
      }
      default:
        throw new Error(`Zod interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
