import type { ASTNode, InterpreterFragment, StepEffect } from "@mvfm/core";
import { injectLambdaParam } from "@mvfm/core";
import { z } from "zod";
import { createArrayInterpreter } from "./array";
import { bigintInterpreter } from "./bigint";
import { dateInterpreter } from "./date";
import { enumInterpreter } from "./enum";
import type { SchemaInterpreterMap } from "./interpreter-utils";
import { toZodError } from "./interpreter-utils";
import { createIntersectionInterpreter } from "./intersection";
import { literalInterpreter } from "./literal";
import { createMapSetInterpreter } from "./map-set";
import { numberInterpreter } from "./number";
import { createObjectInterpreter } from "./object";
import { primitivesInterpreter } from "./primitives";
import { createRecordInterpreter } from "./record";
import { stringInterpreter } from "./string";
import type { ErrorConfig, RefinementDescriptor } from "./types";
import { createUnionInterpreter } from "./union";

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

// Recursive handlers (array, object, union, intersection, record, map, set) need buildSchemaGen for inner schemas.
// Initialized lazily on first use to break the definition-order cycle.
let schemaHandlers: SchemaInterpreterMap | undefined;

/** @internal Resolve all schema handlers, including recursive ones. */
function getHandlers(): SchemaInterpreterMap {
  if (!schemaHandlers) {
    schemaHandlers = {
      ...leafHandlers,
      ...createObjectInterpreter(buildSchemaGen),
      ...createArrayInterpreter(buildSchemaGen),
      ...createUnionInterpreter(buildSchemaGen),
      ...createIntersectionInterpreter(buildSchemaGen),
      ...createRecordInterpreter(buildSchemaGen),
      ...createMapSetInterpreter(buildSchemaGen),
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

    case "zod/tuple": {
      const itemNodes = (node.items as ASTNode[]) ?? [];
      const errorFn = toZodError(node.error as ErrorConfig | undefined);
      const errOpt = errorFn ? { error: errorFn } : {};
      const builtItems: z.ZodType[] = [];
      for (const itemNode of itemNodes) {
        builtItems.push(yield* buildSchemaGen(itemNode));
      }
      let tuple: z.ZodType = z.tuple(builtItems as [z.ZodType, ...z.ZodType[]], errOpt);
      if (node.rest) {
        const restSchema = yield* buildSchemaGen(node.rest as ASTNode);
        tuple = (tuple as any).rest(restSchema);
      }
      return tuple;
    }

    // Transform/pipe/preprocess (#155)
    case "zod/transform": {
      if (node.inner) {
        // Wrapper transform (from .transform(fn) chain) — build inner, transform applied post-validation
        return yield* buildSchemaGen(node.inner as ASTNode);
      }
      // Standalone transform ($.zod.transform(fn)) — accepts any input
      return z.any();
    }
    case "zod/pipe": {
      const source = yield* buildSchemaGen(node.inner as ASTNode);
      const target = yield* buildSchemaGen(node.target as ASTNode);
      return source.pipe(target);
    }
    case "zod/preprocess": {
      // Build inner schema; preprocessing handled in parse operations
      return yield* buildSchemaGen(node.inner as ASTNode);
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
 * Evaluate a single lambda AST node with the given input value.
 * Clones the body, injects the value into the lambda param, and recurses.
 */
function* evaluateLambda(
  value: unknown,
  lambda: { param: { name: string }; body: ASTNode },
): Generator<StepEffect, unknown, unknown> {
  const bodyClone = structuredClone(lambda.body);
  injectLambdaParam(bodyClone, lambda.param.name, value);
  return yield { type: "recurse", child: bodyClone };
}

/**
 * Collect transform lambdas from the schema wrapper chain.
 * Returns lambdas in execution order (innermost first).
 */
function collectTransformLambdas(node: ASTNode): Array<{ param: { name: string }; body: ASTNode }> {
  const transforms: Array<{ param: { name: string }; body: ASTNode }> = [];
  let current = node;
  // Walk through wrapper transforms
  while (current.kind === "zod/transform" && current.inner) {
    transforms.unshift(current.fn as any);
    current = current.inner as ASTNode;
  }
  // Standalone transform (no inner)
  if (current.kind === "zod/transform" && !current.inner && current.fn) {
    transforms.unshift(current.fn as any);
  }
  return transforms;
}

/**
 * Extract preprocess lambda if the schema chain contains a preprocess wrapper.
 * Walks through transform wrappers to find preprocess underneath.
 */
function extractPreprocessLambda(
  node: ASTNode,
): { param: { name: string }; body: ASTNode } | undefined {
  let current = node;
  while (current.kind === "zod/transform" && current.inner) {
    current = current.inner as ASTNode;
  }
  if (current.kind === "zod/preprocess") {
    return current.fn as any;
  }
  return undefined;
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
        let input = yield { type: "recurse", child: node.input as ASTNode };
        const preprocessLambda = extractPreprocessLambda(schemaNode);
        if (preprocessLambda) {
          input = yield* evaluateLambda(input, preprocessLambda);
        }
        let value = schema.parse(input, parseErrorOpt(node));
        const transforms = collectTransformLambdas(schemaNode);
        for (const lambda of transforms) {
          value = yield* evaluateLambda(value, lambda);
        }
        const refinements = extractRefinements(schemaNode);
        if (refinements.length > 0) {
          value = yield* applyRefinements(value, refinements);
        }
        return value;
      }
      case "zod/safe_parse": {
        const schemaNode = node.schema as ASTNode;
        const schema = yield* buildSchemaGen(schemaNode);
        let input = yield { type: "recurse", child: node.input as ASTNode };
        const preprocessLambda = extractPreprocessLambda(schemaNode);
        if (preprocessLambda) {
          input = yield* evaluateLambda(input, preprocessLambda);
        }
        const result = schema.safeParse(input, parseErrorOpt(node));
        if (!result.success) return result;
        let value = result.data;
        const transforms = collectTransformLambdas(schemaNode);
        for (const lambda of transforms) {
          value = yield* evaluateLambda(value, lambda);
        }
        const refinements = extractRefinements(schemaNode);
        if (refinements.length > 0) {
          try {
            const refined = yield* applyRefinements(value, refinements);
            return { success: true, data: refined };
          } catch (e) {
            return { success: false, error: e };
          }
        }
        return transforms.length > 0 ? { success: true, data: value } : result;
      }
      case "zod/parse_async": {
        const schemaNode = node.schema as ASTNode;
        const schema = yield* buildSchemaGen(schemaNode);
        let input = yield { type: "recurse", child: node.input as ASTNode };
        const preprocessLambda = extractPreprocessLambda(schemaNode);
        if (preprocessLambda) {
          input = yield* evaluateLambda(input, preprocessLambda);
        }
        let value = schema.parse(input, parseErrorOpt(node));
        const transforms = collectTransformLambdas(schemaNode);
        for (const lambda of transforms) {
          value = yield* evaluateLambda(value, lambda);
        }
        const refinements = extractRefinements(schemaNode);
        if (refinements.length > 0) {
          value = yield* applyRefinements(value, refinements);
        }
        return value;
      }
      case "zod/safe_parse_async": {
        const schemaNode = node.schema as ASTNode;
        const schema = yield* buildSchemaGen(schemaNode);
        let input = yield { type: "recurse", child: node.input as ASTNode };
        const preprocessLambda = extractPreprocessLambda(schemaNode);
        if (preprocessLambda) {
          input = yield* evaluateLambda(input, preprocessLambda);
        }
        const result = schema.safeParse(input, parseErrorOpt(node));
        if (!result.success) return result;
        let value = result.data;
        const transforms = collectTransformLambdas(schemaNode);
        for (const lambda of transforms) {
          value = yield* evaluateLambda(value, lambda);
        }
        const refinements = extractRefinements(schemaNode);
        if (refinements.length > 0) {
          try {
            const refined = yield* applyRefinements(value, refinements);
            return { success: true, data: refined };
          } catch (e) {
            return { success: false, error: e };
          }
        }
        return transforms.length > 0 ? { success: true, data: value } : result;
      }
      default:
        throw new Error(`Zod interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
