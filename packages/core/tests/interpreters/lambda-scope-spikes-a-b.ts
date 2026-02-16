import { type Counters, inc, lookupScope, type Node } from "./lambda-scope-spikes-types";

type Binding = { paramId: number; value: unknown };

export function runApproachA(root: Node, counters: Counters): unknown {
  type YieldA = Node | { type: "recurse_scoped"; child: Node; bindings: Binding[] };
  const cache = new WeakMap<object, unknown>();
  const tainted = new WeakSet<object>();
  const frames: Map<number, unknown>[] = [];

  function* visit(node: Node): Generator<YieldA, unknown, unknown> {
    switch (node.kind) {
      case "core/literal":
        return node.value;
      case "core/lambda_param":
        return lookupScope(frames, node.__id);
      case "core/tuple": {
        const out: unknown[] = [];
        for (const e of node.elements) out.push(yield e);
        return out;
      }
      case "num/add":
        return (yield node.left) + (yield node.right);
      case "spike/counted":
        inc(counters, node.id);
        return node.value;
      case "spike/invoke":
        return yield {
          type: "recurse_scoped",
          child: node.lambda.body,
          bindings: [{ paramId: node.lambda.param.__id, value: yield node.arg }],
        };
      case "spike/par_map": {
        const items = (yield node.collection) as unknown[];
        const out: unknown[] = [];
        for (const item of items) {
          out.push(
            yield {
              type: "recurse_scoped",
              child: node.body,
              bindings: [{ paramId: node.param.__id, value: item }],
            },
          );
        }
        return out;
      }
      case "spike/try":
        try {
          return yield node.expr;
        } catch (e) {
          return yield {
            type: "recurse_scoped",
            child: node.catch.body,
            bindings: [{ paramId: node.catch.param.__id, value: e }],
          };
        }
      case "spike/throw":
        throw yield node.error;
      case "core/apply_lambda":
        throw new Error("Approach A does not use core/apply_lambda");
    }
  }

  return evalWithScopedEffect(root, visit, cache, tainted, frames);
}

function evalWithScopedEffect(
  root: Node,
  visit: (
    node: Node,
  ) => Generator<
    Node | { type: "recurse_scoped"; child: Node; bindings: Binding[] },
    unknown,
    unknown
  >,
  cache: WeakMap<object, unknown>,
  tainted: WeakSet<object>,
  frames: Map<number, unknown>[],
): unknown {
  function evalNode(node: Node): unknown {
    if (!tainted.has(node as object) && cache.has(node as object)) return cache.get(node as object);
    const gen = visit(node);
    const children = new Set<object>();
    let input: unknown;
    let throwErr = false;
    while (true) {
      const step = throwErr ? gen.throw(input) : gen.next(input);
      throwErr = false;
      if (step.done) {
        const shouldTaint =
          node.kind === "core/lambda_param" || [...children].some((c) => tainted.has(c));
        if (shouldTaint) {
          tainted.add(node as object);
          cache.delete(node as object);
        } else {
          cache.set(node as object, step.value);
        }
        return step.value;
      }
      try {
        if (typeof step.value === "object" && step.value !== null && "type" in step.value) {
          const frame = new Map<number, unknown>(
            step.value.bindings.map((b) => [b.paramId, b.value]),
          );
          frames.push(frame);
          try {
            input = evalNode(step.value.child);
            children.add(step.value.child as object);
          } finally {
            frames.pop();
          }
        } else {
          input = evalNode(step.value as Node);
          children.add(step.value as object);
        }
      } catch (e) {
        input = e;
        throwErr = true;
      }
    }
  }
  return evalNode(root);
}

export function runApproachB(root: Node, counters: Counters): unknown {
  const cache = new WeakMap<object, unknown>();
  const tainted = new WeakSet<object>();
  const frames: Map<number, unknown>[] = [];

  function* visit(node: Node): Generator<Node, unknown, unknown> {
    switch (node.kind) {
      case "core/literal":
        return node.value;
      case "core/lambda_param":
        return lookupScope(frames, node.__id);
      case "core/tuple": {
        const out: unknown[] = [];
        for (const e of node.elements) out.push(yield e);
        return out;
      }
      case "num/add":
        return (yield node.left) + (yield node.right);
      case "spike/counted":
        inc(counters, node.id);
        return node.value;
      case "spike/invoke":
        return yield {
          kind: "core/apply_lambda",
          param: node.lambda.param,
          body: node.lambda.body,
          arg: node.arg,
        };
      case "spike/par_map": {
        const items = (yield node.collection) as unknown[];
        const out: unknown[] = [];
        for (const item of items) {
          out.push(
            yield {
              kind: "core/apply_lambda",
              param: node.param,
              body: node.body,
              arg: { kind: "core/literal", value: item },
            },
          );
        }
        return out;
      }
      case "spike/try":
        try {
          return yield node.expr;
        } catch (e) {
          return yield {
            kind: "core/apply_lambda",
            param: node.catch.param,
            body: node.catch.body,
            arg: { kind: "core/literal", value: e },
          };
        }
      case "spike/throw":
        throw yield node.error;
      case "core/apply_lambda":
        throw new Error("Evaluator handles core/apply_lambda directly");
    }
  }

  function evalNode(node: Node): unknown {
    if (node.kind === "core/apply_lambda") {
      const arg = evalNode(node.arg);
      frames.push(new Map([[node.param.__id, arg]]));
      try {
        return evalNode(node.body);
      } finally {
        frames.pop();
      }
    }
    if (!tainted.has(node as object) && cache.has(node as object)) return cache.get(node as object);
    const gen = visit(node);
    const children = new Set<object>();
    let input: unknown;
    let throwErr = false;
    while (true) {
      const step = throwErr ? gen.throw(input) : gen.next(input);
      throwErr = false;
      if (step.done) {
        const shouldTaint =
          node.kind === "core/lambda_param" || [...children].some((c) => tainted.has(c));
        if (shouldTaint) {
          tainted.add(node as object);
          cache.delete(node as object);
        } else {
          cache.set(node as object, step.value);
        }
        return step.value;
      }
      try {
        input = evalNode(step.value as Node);
        children.add(step.value as object);
      } catch (e) {
        input = e;
        throwErr = true;
      }
    }
  }

  return evalNode(root);
}
