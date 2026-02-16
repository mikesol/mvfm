import type { FoldYield, Interpreter, TypedNode } from "@mvfm/core";
import { eval_ } from "@mvfm/core";
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
import { specialInterpreter } from "./special";
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
  ...specialInterpreter,
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
 * Build a Zod schema from a schema AST node (async generator version).
 * Dispatches to per-schema handlers, then handles shared wrappers.
 */
async function* buildSchemaGen(node: any): AsyncGenerator<TypedNode, z.ZodType, unknown> {
  // Schema type dispatch
  const handler = getHandlers()[node.kind];
  if (handler) return yield* handler(node);

  // Shared wrappers (stable — never changes per schema type)
  switch (node.kind) {
    case "zod/optional":
      return (yield* buildSchemaGen(node.inner)).optional();
    case "zod/nullable":
      return (yield* buildSchemaGen(node.inner)).nullable();
    case "zod/nullish":
      return (yield* buildSchemaGen(node.inner)).nullish();
    case "zod/nonoptional":
      return (yield* buildSchemaGen(node.inner) as any).nonoptional();
    case "zod/readonly":
      return (yield* buildSchemaGen(node.inner)).readonly();
    case "zod/branded":
      return (yield* buildSchemaGen(node.inner)).brand(node.brand as string);
    case "zod/default": {
      const inner = yield* buildSchemaGen(node.inner);
      const value = yield* eval_(node.value);
      return inner.default(value);
    }
    case "zod/prefault": {
      const inner = yield* buildSchemaGen(node.inner);
      const value = yield* eval_(node.value);
      return (inner as any).prefault(value);
    }
    case "zod/catch": {
      const inner = yield* buildSchemaGen(node.inner);
      const value = yield* eval_(node.value);
      return inner.catch(value);
    }

    case "zod/tuple": {
      const itemNodes = (node.items as any[]) ?? [];
      const errorFn = toZodError(node.error as ErrorConfig | undefined);
      const errOpt = errorFn ? { error: errorFn } : {};
      const builtItems: z.ZodType[] = [];
      for (const itemNode of itemNodes) {
        builtItems.push(yield* buildSchemaGen(itemNode));
      }
      let tuple: z.ZodType = z.tuple(builtItems as [z.ZodType, ...z.ZodType[]], errOpt);
      if (node.rest) {
        const restSchema = yield* buildSchemaGen(node.rest);
        tuple = (tuple as any).rest(restSchema);
      }
      return tuple;
    }

    // Transform/pipe/preprocess (#155)
    case "zod/transform": {
      if (node.inner) {
        // Wrapper transform (from .transform(fn) chain) — build inner, transform applied post-validation
        return yield* buildSchemaGen(node.inner);
      }
      // Standalone transform ($.zod.transform(fn)) — accepts any input
      return z.any();
    }
    case "zod/pipe": {
      const source = yield* buildSchemaGen(node.inner);
      const target = yield* buildSchemaGen(node.target);
      return source.pipe(target);
    }
    case "zod/preprocess": {
      // Build inner schema; preprocessing handled in parse operations
      return yield* buildSchemaGen(node.inner);
    }

    // Special types (#157) — promise needs buildSchemaGen for inner schema
    case "zod/promise":
      return z.promise(yield* buildSchemaGen(node.inner));

    default:
      throw new Error(`Zod interpreter: unknown schema kind "${node.kind}"`);
  }
}

/**
 * Build parse-level error option from the parseError field on validation nodes.
 */
function parseErrorOpt(node: any): { error?: (iss: unknown) => string } {
  const fn = toZodError(node.parseError as ErrorConfig | undefined);
  return fn ? { error: fn } : {};
}

/**
 * Extract refinements from a schema AST node.
 * Refinements live on the base schema node, not on wrappers.
 * For `zod/custom` schemas, the predicate is treated as an additional refinement.
 */
function extractRefinements(schemaNode: any): RefinementDescriptor[] {
  const refinements = (schemaNode.refinements as RefinementDescriptor[] | undefined) ?? [];
  if (schemaNode.kind === "zod/custom" && schemaNode.predicate) {
    const predRef: RefinementDescriptor = {
      kind: "refine",
      fn: schemaNode.predicate,
      error: typeof schemaNode.error === "string" ? schemaNode.error : "Custom validation failed",
    };
    return [predRef, ...refinements];
  }
  return refinements;
}

/**
 * Evaluate a single lambda AST node with the given input value.
 * Clones the body, injects the value into the lambda param, and recurses.
 */
async function* evaluateLambda(
  value: unknown,
  lambda: { param: { __id: number; name?: string }; body: any },
): AsyncGenerator<FoldYield, unknown, unknown> {
  return yield {
    type: "recurse_scoped",
    child: lambda.body,
    bindings: [{ paramId: lambda.param.__id, value }],
  };
}

/**
 * Collect transform lambdas from the schema wrapper chain.
 * Returns lambdas in execution order (innermost first).
 */
function collectTransformLambdas(
  node: any,
): Array<{ param: { __id: number; name?: string }; body: any }> {
  const transforms: Array<{ param: { __id: number; name?: string }; body: any }> = [];
  let current = node;
  // Walk through wrapper transforms
  while (current.kind === "zod/transform" && current.inner) {
    transforms.unshift(current.fn as any);
    current = current.inner;
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
  node: any,
): { param: { __id: number; name?: string }; body: any } | undefined {
  let current = node;
  while (current.kind === "zod/transform" && current.inner) {
    current = current.inner;
  }
  if (current.kind === "zod/preprocess") {
    return current.fn as any;
  }
  return undefined;
}

/**
 * Apply refinement descriptors to a validated value via the async generator pipeline.
 */
async function* applyRefinements(
  value: unknown,
  refinements: RefinementDescriptor[],
): AsyncGenerator<FoldYield, unknown, unknown> {
  let current = value;
  for (const ref of refinements) {
    const lambda = ref.fn as unknown as { param: { __id: number }; body: any };
    const result = yield {
      type: "recurse_scoped",
      child: lambda.body,
      bindings: [{ paramId: lambda.param.__id, value: current }],
    };

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
 * Handle a parse-like operation: build schema, evaluate input,
 * apply preprocessing, validation, transforms, and refinements.
 */
async function* handleParse(node: any, safe: boolean): AsyncGenerator<FoldYield, unknown, unknown> {
  const schemaNode = node.schema;
  const schema = yield* buildSchemaGen(schemaNode);
  let input = yield* eval_(node.input);
  const preprocessLambda = extractPreprocessLambda(schemaNode);
  if (preprocessLambda) {
    input = yield* evaluateLambda(input, preprocessLambda);
  }

  if (safe) {
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

/**
 * Creates the zod interpreter.
 *
 * Handles parsing operation nodes by recursing into schema + input,
 * reconstructing the Zod schema from AST, and executing validation.
 *
 * @returns An Interpreter for zod node kinds.
 */
export function createZodInterpreter(): Interpreter {
  return {
    "zod/parse": async function* (node: any) {
      return yield* handleParse(node, false);
    },
    "zod/safe_parse": async function* (node: any) {
      return yield* handleParse(node, true);
    },
    "zod/parse_async": async function* (node: any) {
      return yield* handleParse(node, false);
    },
    "zod/safe_parse_async": async function* (node: any) {
      return yield* handleParse(node, true);
    },
  };
}
