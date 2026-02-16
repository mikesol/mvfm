import type { FoldYield, TypedNode } from "@mvfm/core";
import { toZodError } from "./interpreter-utils";
import type {
  AnyZodSchemaNode,
  ErrorConfig,
  RefinementDescriptor,
  ValidationASTNode,
  ZodLambdaNode,
  ZodSchemaNodeBase,
} from "./types";

export function parseErrorOpt(node: ValidationASTNode): { error?: (iss: unknown) => string } {
  const fn = toZodError(node.parseError as ErrorConfig | undefined);
  return fn ? { error: fn } : {};
}

export function extractRefinements(schemaNode: AnyZodSchemaNode): RefinementDescriptor[] {
  const refinements = (schemaNode.refinements as RefinementDescriptor[] | undefined) ?? [];
  if (schemaNode.kind === "zod/custom" && schemaNode.predicate) {
    const predRef: RefinementDescriptor = {
      kind: "refine",
      fn: schemaNode.predicate as TypedNode,
      error: typeof schemaNode.error === "string" ? schemaNode.error : "Custom validation failed",
    };
    return [predRef, ...refinements];
  }
  return refinements;
}

export async function* evaluateLambda(
  value: unknown,
  lambda: ZodLambdaNode,
): AsyncGenerator<FoldYield, unknown, unknown> {
  return yield {
    type: "recurse_scoped",
    child: lambda.body as TypedNode,
    bindings: [{ paramId: lambda.param.__id, value }],
  };
}

export function collectTransformLambdas(node: AnyZodSchemaNode): ZodLambdaNode[] {
  const transforms: ZodLambdaNode[] = [];
  let current: AnyZodSchemaNode = node;

  while (current.kind === "zod/transform" && current.inner) {
    transforms.unshift(current.fn as ZodLambdaNode);
    current = current.inner as AnyZodSchemaNode;
  }

  if (current.kind === "zod/transform" && !current.inner && current.fn) {
    transforms.unshift(current.fn as ZodLambdaNode);
  }

  return transforms;
}

export function extractPreprocessLambda(node: AnyZodSchemaNode): ZodLambdaNode | undefined {
  let current: AnyZodSchemaNode = node;
  while (current.kind === "zod/transform" && current.inner) {
    current = current.inner as AnyZodSchemaNode;
  }
  if (current.kind === "zod/preprocess") {
    return current.fn as ZodLambdaNode;
  }
  return undefined;
}

export async function* applyRefinements(
  value: unknown,
  refinements: RefinementDescriptor[],
): AsyncGenerator<FoldYield, unknown, unknown> {
  let current = value;
  for (const ref of refinements) {
    const lambda = ref.fn as ZodLambdaNode;
    const result = yield {
      type: "recurse_scoped",
      child: lambda.body as ZodSchemaNodeBase,
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
