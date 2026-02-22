import type { FoldYield, Interpreter, RuntimeEntry } from "@mvfm/core";
import { z } from "zod";
import { createArrayInterpreter } from "./array";
import { bigintInterpreter } from "./bigint";
import { dateInterpreter } from "./date";
import { createDiscriminatedUnionInterpreter } from "./discriminated-union";
import { enumInterpreter } from "./enum";
import type { SchemaInterpreterMap } from "./interpreter-utils";
import { toZodError } from "./interpreter-utils";
import { createIntersectionInterpreter } from "./intersection";
import { createLazyInterpreter } from "./lazy";
import { literalInterpreter } from "./literal";
import { createMapSetInterpreter } from "./map-set";
import { numberInterpreter } from "./number";
import { createObjectInterpreter } from "./object";
import {
  applyRefinements,
  collectTransformLambdas,
  evaluateLambda,
  extractPreprocessLambda,
  extractRefinements,
  parseErrorOpt,
} from "./parse-helpers";
import { primitivesInterpreter } from "./primitives";
import { createRecordInterpreter } from "./record";
import { specialInterpreter } from "./special";
import { stringInterpreter } from "./string";
import { stringboolInterpreter } from "./stringbool";
import { createTemplateLiteralInterpreter } from "./template-literal";
import type { AnyZodSchemaNode } from "./types";
import { createUnionInterpreter } from "./union";
import { zodNonoptional, zodPrefault, zodTupleRest } from "./zod-compat";

const leafHandlers: SchemaInterpreterMap = {
  ...stringInterpreter,
  ...bigintInterpreter,
  ...dateInterpreter,
  ...enumInterpreter,
  ...literalInterpreter,
  ...numberInterpreter,
  ...primitivesInterpreter,
  ...specialInterpreter,
  ...stringboolInterpreter,
};

function createSchemaBuilder() {
  let schemaHandlers: SchemaInterpreterMap | undefined;
  const buildSchema = async function* (
    node: AnyZodSchemaNode,
  ): AsyncGenerator<unknown, z.ZodType, unknown> {
    const handler = getHandlers()[node.kind];
    if (handler) return yield* handler(node);

    switch (node.kind) {
      case "zod/optional":
        return (yield* buildSchema(node.inner as AnyZodSchemaNode)).optional();
      case "zod/nullable":
        return (yield* buildSchema(node.inner as AnyZodSchemaNode)).nullable();
      case "zod/nullish":
        return (yield* buildSchema(node.inner as AnyZodSchemaNode)).nullish();
      case "zod/nonoptional":
        return zodNonoptional(yield* buildSchema(node.inner as AnyZodSchemaNode));
      case "zod/readonly":
        return (yield* buildSchema(node.inner as AnyZodSchemaNode)).readonly();
      case "zod/branded":
        return (yield* buildSchema(node.inner as AnyZodSchemaNode)).brand(node.brand as string);
      case "zod/default": {
        const inner = yield* buildSchema(node.inner as AnyZodSchemaNode);
        // In the new system, value is stored directly in the descriptor
        // (not as a CExpr ref — from-zod stores plain values)
        return inner.default(node.value);
      }
      case "zod/prefault": {
        const inner = yield* buildSchema(node.inner as AnyZodSchemaNode);
        return zodPrefault(inner, node.value);
      }
      case "zod/catch": {
        const inner = yield* buildSchema(node.inner as AnyZodSchemaNode);
        return inner.catch(node.value);
      }
      case "zod/tuple": {
        const itemNodes = (node.items as AnyZodSchemaNode[] | undefined) ?? [];
        const errorFn = toZodError(node.error);
        const errOpt = errorFn ? { error: errorFn } : {};
        const builtItems: z.ZodType[] = [];
        for (const itemNode of itemNodes) {
          builtItems.push(yield* buildSchema(itemNode));
        }
        let tuple: z.ZodType = z.tuple(builtItems as [z.ZodType, ...z.ZodType[]], errOpt);
        if (node.rest) {
          const restSchema = yield* buildSchema(node.rest as AnyZodSchemaNode);
          tuple = zodTupleRest(tuple, restSchema);
        }
        return tuple;
      }
      case "zod/transform": {
        if (node.inner) {
          return yield* buildSchema(node.inner as AnyZodSchemaNode);
        }
        return z.any();
      }
      case "zod/pipe": {
        const source = yield* buildSchema(node.inner as AnyZodSchemaNode);
        const target = yield* buildSchema(node.target as AnyZodSchemaNode);
        return source.pipe(target);
      }
      case "zod/preprocess":
        return yield* buildSchema(node.inner as AnyZodSchemaNode);
      case "zod/promise":
        return z.promise(yield* buildSchema(node.inner as AnyZodSchemaNode));
      default:
        throw new Error(`Zod interpreter: unknown schema kind "${node.kind}"`);
    }
  };

  function getHandlers(): SchemaInterpreterMap {
    if (!schemaHandlers) {
      schemaHandlers = {
        ...leafHandlers,
        ...createObjectInterpreter(buildSchema),
        ...createArrayInterpreter(buildSchema),
        ...createUnionInterpreter(buildSchema),
        ...createDiscriminatedUnionInterpreter(buildSchema),
        ...createIntersectionInterpreter(buildSchema),
        ...createRecordInterpreter(buildSchema),
        ...createMapSetInterpreter(buildSchema),
        ...createLazyInterpreter(buildSchema),
        ...createTemplateLiteralInterpreter(buildSchema),
      };
    }
    return schemaHandlers;
  }

  return buildSchema;
}

/**
 * Collect all __ref indices that appear inside lambda descriptors.
 * Lambda descriptors have `{ param: { __ref: N }, body: { __ref: M } }` and appear
 * under `fn` (transforms/refinements) or `predicate` (custom schemas).
 * These refs must NOT be eagerly evaluated — they are used with recurseScoped.
 */
function collectLambdaRefIndices(obj: unknown, indices: Set<number>): void {
  if (obj === null || obj === undefined || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    for (const item of obj) collectLambdaRefIndices(item, indices);
    return;
  }
  const record = obj as Record<string, unknown>;
  // Check known lambda-bearing fields: "fn" and "predicate"
  for (const field of ["fn", "predicate"]) {
    if (field in record && typeof record[field] === "object" && record[field] !== null) {
      const lambda = record[field] as Record<string, unknown>;
      for (const part of ["param", "body"]) {
        if (part in lambda && typeof lambda[part] === "object" && lambda[part] !== null) {
          const ref = lambda[part] as Record<string, unknown>;
          if ("__ref" in ref && typeof ref.__ref === "number") indices.add(ref.__ref);
        }
      }
    }
  }
  // Recurse into nested objects (e.g., refinements arrays, wrapper inners)
  for (const value of Object.values(record)) {
    if (typeof value === "object" && value !== null) {
      collectLambdaRefIndices(value, indices);
    }
  }
}

/**
 * Resolve __ref placeholders in a deserialized descriptor.
 * Each { __ref: N } is replaced with the resolved value from the resolvedRefs map.
 * Lambda refs (in skipIndices) are left as { __ref: N } for deferred evaluation.
 */
function resolveRefs(
  obj: unknown,
  resolvedRefs: Map<number, unknown>,
  skipIndices: Set<number>,
): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map((item) => resolveRefs(item, resolvedRefs, skipIndices));
  if (typeof obj === "object") {
    const record = obj as Record<string, unknown>;
    if ("__ref" in record && typeof record.__ref === "number") {
      if (skipIndices.has(record.__ref)) return record; // Keep as { __ref: N }
      return resolvedRefs.get(record.__ref);
    }
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      result[key] = resolveRefs(value, resolvedRefs, skipIndices);
    }
    return result;
  }
  return obj;
}

/**
 * Handle a parse/safeParse operation using the new RuntimeEntry model.
 *
 * entry.children layout:
 *   [0] = serialized JSON metadata (string)
 *   [1] = input value
 *   [2..] = extracted CExpr ref values
 *
 * Lambda refs (fn.param, fn.body in transforms/refinements/predicates) are NOT eagerly
 * evaluated. They are kept as { __ref: N } placeholders and evaluated via recurseScoped
 * when the lambda is actually invoked.
 */
async function* handleParse(
  entry: RuntimeEntry,
  safe: boolean,
): AsyncGenerator<FoldYield, unknown, unknown> {
  // Yield index 0 to get the serialized JSON string
  const serialized = (yield 0) as string;
  // Yield index 1 to get the input value
  let input = yield 1;

  // Parse JSON to determine which refs are lambda components (must not be eagerly evaluated)
  const rawDescriptor = JSON.parse(serialized);
  const lambdaRefIndices = new Set<number>();
  collectLambdaRefIndices(rawDescriptor, lambdaRefIndices);

  // Eagerly resolve only non-lambda refs
  const resolvedRefs = new Map<number, unknown>();
  for (let i = 2; i < entry.children.length; i++) {
    const refIdx = i - 2;
    if (!lambdaRefIndices.has(refIdx)) {
      resolvedRefs.set(refIdx, yield i);
    }
  }

  // Resolve __ref placeholders (skipping lambda refs)
  const descriptor = resolveRefs(rawDescriptor, resolvedRefs, lambdaRefIndices) as Record<
    string,
    unknown
  >;

  const schemaNode = descriptor.schema as AnyZodSchemaNode;
  const parseError = descriptor.parseError;

  // Build the zod schema from the descriptor (internal generator, doesn't yield to fold)
  const buildSchema = createSchemaBuilder();
  const schema = yield* buildSchema(schemaNode) as AsyncGenerator<FoldYield, z.ZodType, unknown>;

  // Handle preprocess
  const preprocessLambda = extractPreprocessLambda(schemaNode);
  if (preprocessLambda) {
    input = yield* evaluateLambda(input, preprocessLambda, entry);
  }

  if (safe) {
    const result = schema.safeParse(input, parseErrorOpt(parseError as string | undefined));
    if (!result.success) return result;
    let value = result.data;
    const transforms = collectTransformLambdas(schemaNode);
    for (const lambda of transforms) {
      value = yield* evaluateLambda(value, lambda, entry);
    }
    const refinements = extractRefinements(schemaNode);
    if (refinements.length > 0) {
      try {
        const refined = yield* applyRefinements(value, refinements, entry);
        return { success: true, data: refined };
      } catch (e) {
        return { success: false, error: e };
      }
    }
    return transforms.length > 0 ? { success: true, data: value } : result;
  }

  let value = schema.parse(input, parseErrorOpt(parseError as string | undefined));
  const transforms = collectTransformLambdas(schemaNode);
  for (const lambda of transforms) {
    value = yield* evaluateLambda(value, lambda, entry);
  }
  const refinements = extractRefinements(schemaNode);
  if (refinements.length > 0) {
    value = yield* applyRefinements(value, refinements, entry);
  }
  return value;
}

/**
 * Create the Zod interpreter for the unified Plugin system.
 *
 * Only 4 node kinds appear in the adjacency map: zod/parse, zod/safe_parse,
 * zod/parse_async, zod/safe_parse_async. All schema descriptors are serialized
 * to JSON metadata in children[0].
 */
export function createZodInterpreter(): Interpreter {
  return {
    "zod/parse": async function* (entry: RuntimeEntry) {
      return yield* handleParse(entry, false);
    },
    "zod/safe_parse": async function* (entry: RuntimeEntry) {
      return yield* handleParse(entry, true);
    },
    "zod/parse_async": async function* (entry: RuntimeEntry) {
      return yield* handleParse(entry, false);
    },
    "zod/safe_parse_async": async function* (entry: RuntimeEntry) {
      return yield* handleParse(entry, true);
    },
  };
}
