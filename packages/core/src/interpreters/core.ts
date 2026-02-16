import type { Interpreter, TypedNode } from "../fold";
import { eval_ } from "../fold";

// ---- Typed node interfaces ----------------------------------

interface CoreLiteral<T = unknown> extends TypedNode<T> {
  kind: "core/literal";
  value: T;
}

interface CoreInput extends TypedNode<unknown> {
  kind: "core/input";
  __inputData?: unknown;
}

interface CorePropAccess<T = unknown> extends TypedNode<T> {
  kind: "core/prop_access";
  object: TypedNode<Record<string, unknown>>;
  property: string;
}

interface CoreRecord extends TypedNode<Record<string, unknown>> {
  kind: "core/record";
  fields: Record<string, TypedNode>;
}

interface CoreCond<T = unknown> extends TypedNode<T> {
  kind: "core/cond";
  predicate: TypedNode<boolean>;
  then: TypedNode<T>;
  else: TypedNode<T>;
}

interface CoreBegin<T = unknown> extends TypedNode<T> {
  kind: "core/begin";
  steps: TypedNode[];
  result: TypedNode<T>;
}

interface CoreProgram extends TypedNode<unknown> {
  kind: "core/program";
  result: TypedNode;
}

interface CoreTuple extends TypedNode<unknown[]> {
  kind: "core/tuple";
  elements: TypedNode[];
}

interface CoreLambdaParam<T = unknown> extends TypedNode<T> {
  kind: "core/lambda_param";
  __value?: T;
}

// ---- Interpreter map ----------------------------------------

/** Interpreter handlers for core node kinds. */
export const coreInterpreter: Interpreter = {
  // biome-ignore lint/correctness/useYield: leaf handler returns directly
  "core/literal": async function* (node: CoreLiteral) {
    return node.value;
  },

  // biome-ignore lint/correctness/useYield: leaf handler returns directly
  "core/input": async function* (node: CoreInput) {
    return node.__inputData;
  },

  "core/prop_access": async function* (node: CorePropAccess) {
    const obj = yield* eval_(node.object);
    return obj[node.property];
  },

  "core/record": async function* (node: CoreRecord) {
    const result: Record<string, unknown> = {};
    for (const [key, fieldNode] of Object.entries(node.fields)) {
      result[key] = yield* eval_(fieldNode);
    }
    return result;
  },

  "core/cond": async function* (node: CoreCond) {
    const predicate = yield* eval_(node.predicate);
    if (predicate) {
      return yield* eval_(node.then);
    }
    return yield* eval_(node.else);
  },

  "core/begin": async function* (node: CoreBegin) {
    for (const step of node.steps) {
      yield* eval_(step);
    }
    return yield* eval_(node.result);
  },

  "core/program": async function* (node: CoreProgram) {
    return yield* eval_(node.result);
  },

  "core/tuple": async function* (node: CoreTuple) {
    const results: unknown[] = [];
    for (const el of node.elements) {
      results.push(yield* eval_(el));
    }
    return results;
  },

  // biome-ignore lint/correctness/useYield: leaf handler returns directly
  "core/lambda_param": async function* (node: CoreLambdaParam) {
    return node.__value;
  },
};
