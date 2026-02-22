import type { FoldYield, RuntimeEntry } from "@mvfm/core";
import { recurseScoped } from "@mvfm/core";
import { toZodError } from "./interpreter-utils";
import type { AnyZodSchemaNode, ErrorConfig, RefinementDescriptor, ZodLambdaNode } from "./types";

export function parseErrorOpt(parseError: ErrorConfig | undefined): {
  error?: (iss: unknown) => string;
} {
  const fn = toZodError(parseError);
  return fn ? { error: fn } : {};
}

export function extractRefinements(schemaNode: AnyZodSchemaNode): RefinementDescriptor[] {
  const refinements = (schemaNode.refinements as RefinementDescriptor[] | undefined) ?? [];
  if (schemaNode.kind === "zod/custom" && schemaNode.predicate) {
    const predRef: RefinementDescriptor = {
      kind: "refine",
      fn: schemaNode.predicate as unknown,
      error: typeof schemaNode.error === "string" ? schemaNode.error : "Custom validation failed",
    };
    return [predRef, ...refinements];
  }
  return refinements;
}

/**
 * Children offset: children[0] = serialized JSON, children[1] = input value,
 * children[2..] = extracted CExpr refs. So __ref index N maps to children[N + 2].
 */
const CHILDREN_REF_OFFSET = 2;

/**
 * Evaluate a lambda descriptor from deserialized metadata.
 *
 * In the new system, lambda descriptors contain `{ param: { __ref: N }, body: { __ref: M } }`
 * where N and M are 0-based indices into the extracted refs array. These map to
 * entry.children[N + 2] and entry.children[M + 2] respectively. The resolved node IDs
 * are used with recurseScoped to evaluate the lambda body under scoped bindings.
 */
export async function* evaluateLambda(
  value: unknown,
  lambda: ZodLambdaNode,
  entry: RuntimeEntry,
): AsyncGenerator<FoldYield, unknown, unknown> {
  // lambda.param and lambda.body are { __ref: N } placeholders
  const paramRef = lambda.param as { __ref: number };
  const bodyRef = lambda.body as { __ref: number };
  const paramId = entry.children[paramRef.__ref + CHILDREN_REF_OFFSET];
  const bodyId = entry.children[bodyRef.__ref + CHILDREN_REF_OFFSET];
  return yield recurseScoped(bodyId, [{ paramId, value }]);
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
  entry: RuntimeEntry,
): AsyncGenerator<FoldYield, unknown, unknown> {
  let current = value;
  for (const ref of refinements) {
    const lambda = ref.fn as ZodLambdaNode;
    const paramRef = lambda.param as { __ref: number };
    const bodyRef = lambda.body as { __ref: number };
    const paramId = entry.children[paramRef.__ref + CHILDREN_REF_OFFSET];
    const bodyId = entry.children[bodyRef.__ref + CHILDREN_REF_OFFSET];
    const result = yield recurseScoped(bodyId, [{ paramId, value: current }]);

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
