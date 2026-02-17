import type { FoldYield, Interpreter, TypedNode } from "@mvfm/core";
import { defineInterpreter, eval_ } from "@mvfm/core";
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
import type { AnyZodSchemaNode, ValidationASTNode } from "./types";
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
};

function createSchemaBuilder() {
  let schemaHandlers: SchemaInterpreterMap | undefined;
  const buildSchema = async function* (
    node: AnyZodSchemaNode,
  ): AsyncGenerator<TypedNode, z.ZodType, unknown> {
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
        const value = yield* eval_(node.value as TypedNode);
        return inner.default(value);
      }
      case "zod/prefault": {
        const inner = yield* buildSchema(node.inner as AnyZodSchemaNode);
        const value = yield* eval_(node.value as TypedNode);
        return zodPrefault(inner, value);
      }
      case "zod/catch": {
        const inner = yield* buildSchema(node.inner as AnyZodSchemaNode);
        const value = yield* eval_(node.value as TypedNode);
        return inner.catch(value);
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
      };
    }
    return schemaHandlers;
  }

  return buildSchema;
}

async function* handleParse(
  node: ValidationASTNode,
  safe: boolean,
): AsyncGenerator<FoldYield, unknown, unknown> {
  const buildSchema = createSchemaBuilder();
  const schemaNode = node.schema;
  const schema = yield* buildSchema(schemaNode as AnyZodSchemaNode);
  let input = yield* eval_(node.input);
  const preprocessLambda = extractPreprocessLambda(schemaNode as AnyZodSchemaNode);

  if (preprocessLambda) {
    input = yield* evaluateLambda(input, preprocessLambda);
  }

  if (safe) {
    const result = schema.safeParse(input, parseErrorOpt(node));
    if (!result.success) return result;
    let value = result.data;
    const transforms = collectTransformLambdas(schemaNode as AnyZodSchemaNode);
    for (const lambda of transforms) {
      value = yield* evaluateLambda(value, lambda);
    }
    const refinements = extractRefinements(schemaNode as AnyZodSchemaNode);
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
  const transforms = collectTransformLambdas(schemaNode as AnyZodSchemaNode);
  for (const lambda of transforms) {
    value = yield* evaluateLambda(value, lambda);
  }
  const refinements = extractRefinements(schemaNode as AnyZodSchemaNode);
  if (refinements.length > 0) {
    value = yield* applyRefinements(value, refinements);
  }
  return value;
}

export function createZodInterpreter(): Interpreter {
  return defineInterpreter<
    "zod/parse" | "zod/safe_parse" | "zod/parse_async" | "zod/safe_parse_async"
  >()({
    "zod/parse": async function* (node: ValidationASTNode) {
      return yield* handleParse(node, false);
    },
    "zod/safe_parse": async function* (node: ValidationASTNode) {
      return yield* handleParse(node, true);
    },
    "zod/parse_async": async function* (node: ValidationASTNode) {
      return yield* handleParse(node, false);
    },
    "zod/safe_parse_async": async function* (node: ValidationASTNode) {
      return yield* handleParse(node, true);
    },
  });
}
