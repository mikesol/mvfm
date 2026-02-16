import { type Counters, inc, type Node } from "./lambda-scope-spikes-types";

export function runApproachC(root: Node, counters: Counters): unknown {
  const cache = new WeakMap<object, unknown>();
  const tainted = new WeakSet<object>();

  function evalNode(node: Node, env: Map<number, unknown>): unknown {
    if (
      node.kind !== "core/lambda_param" &&
      !tainted.has(node as object) &&
      cache.has(node as object)
    ) {
      return cache.get(node as object);
    }
    const children = new Set<object>();
    const value = (() => {
      switch (node.kind) {
        case "core/literal":
          return node.value;
        case "core/lambda_param":
          if (!env.has(node.__id)) throw new Error(`Unbound lambda param id=${node.__id}`);
          return env.get(node.__id);
        case "core/tuple":
          return node.elements.map((e) => {
            children.add(e as object);
            return evalNode(e, env);
          });
        case "num/add": {
          children.add(node.left as object);
          children.add(node.right as object);
          return (evalNode(node.left, env) as number) + (evalNode(node.right, env) as number);
        }
        case "spike/counted":
          inc(counters, node.id);
          return node.value;
        case "spike/invoke": {
          children.add(node.arg as object);
          children.add(node.lambda.body as object);
          const next = new Map(env);
          next.set(node.lambda.param.__id, evalNode(node.arg, env));
          return evalNode(node.lambda.body, next);
        }
        case "spike/par_map": {
          children.add(node.collection as object);
          children.add(node.body as object);
          return (evalNode(node.collection, env) as unknown[]).map((item) => {
            const next = new Map(env);
            next.set(node.param.__id, item);
            return evalNode(node.body, next);
          });
        }
        case "spike/try":
          try {
            children.add(node.expr as object);
            return evalNode(node.expr, env);
          } catch (e) {
            children.add(node.catch.body as object);
            const next = new Map(env);
            next.set(node.catch.param.__id, e);
            return evalNode(node.catch.body, next);
          }
        case "spike/throw":
          throw evalNode(node.error, env);
        case "core/apply_lambda": {
          children.add(node.body as object);
          const next = new Map(env);
          next.set(node.param.__id, evalNode(node.arg, env));
          return evalNode(node.body, next);
        }
      }
    })();

    const shouldTaint =
      node.kind === "core/lambda_param" || [...children].some((c) => tainted.has(c));
    if (shouldTaint) {
      tainted.add(node as object);
      cache.delete(node as object);
    } else {
      cache.set(node as object, value);
    }
    return value;
  }

  return evalNode(root, new Map<number, unknown>());
}
