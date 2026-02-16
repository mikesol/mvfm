import { describe, expect, it } from "vitest";
import type { Interpreter, TypedNode } from "../../src/fold";
import { eval_, foldAST } from "../../src/fold";
import { coreInterpreter } from "../../src/interpreters/core";

interface InvokeNode extends TypedNode<unknown> {
  kind: "test/invoke";
  param: { kind: "core/lambda_param"; __id: number; name: string };
  arg: TypedNode;
  body: TypedNode;
}

interface PairNode extends TypedNode<[unknown, unknown]> {
  kind: "test/pair";
  left: TypedNode;
  right: TypedNode;
}

interface CounterNode extends TypedNode<number> {
  kind: "test/counter";
  id: string;
  value: number;
}

function createInterpreter(counters: Map<string, number>): Interpreter {
  const testInterpreter: Interpreter = {
    "test/invoke": async function* (node: InvokeNode) {
      const arg = yield* eval_(node.arg);
      return yield {
        type: "recurse_scoped",
        child: node.body,
        bindings: [{ paramId: node.param.__id, value: arg }],
      } as any;
    },
    "test/pair": async function* (node: PairNode) {
      return [(yield* eval_(node.left)) as unknown, (yield* eval_(node.right)) as unknown];
    },
    // biome-ignore lint/correctness/useYield: leaf handler returns directly
    "test/counter": async function* (node: CounterNode) {
      counters.set(node.id, (counters.get(node.id) ?? 0) + 1);
      return node.value;
    },
  };

  return {
    ...coreInterpreter,
    ...testInterpreter,
  };
}

describe("foldAST recurse_scoped", () => {
  it("binds lambda params lexically by param id", async () => {
    const counters = new Map<string, number>();
    const interpreter = createInterpreter(counters);

    const outerParam = { kind: "core/lambda_param", __id: 101, name: "x" } as const;
    const innerParam = { kind: "core/lambda_param", __id: 202, name: "x" } as const;

    const nestedInvoke: InvokeNode = {
      kind: "test/invoke",
      param: innerParam,
      arg: { kind: "core/literal", value: 99 },
      body: innerParam,
    };

    const ast: InvokeNode = {
      kind: "test/invoke",
      param: outerParam,
      arg: { kind: "core/literal", value: 10 },
      body: {
        kind: "core/tuple",
        elements: [outerParam, nestedInvoke],
      },
    };

    await expect(foldAST(interpreter, ast)).resolves.toEqual([10, 99]);
  });

  it("keeps stable child cached across scoped invocations", async () => {
    const counters = new Map<string, number>();
    const interpreter = createInterpreter(counters);

    const itemParam = { kind: "core/lambda_param", __id: 303, name: "item" } as const;
    const body: PairNode = {
      kind: "test/pair",
      left: itemParam,
      right: { kind: "test/counter", id: "stable", value: 7 },
    };

    const ast: PairNode = {
      kind: "test/pair",
      left: {
        kind: "test/invoke",
        param: itemParam,
        arg: { kind: "core/literal", value: 1 },
        body,
      },
      right: {
        kind: "test/invoke",
        param: itemParam,
        arg: { kind: "core/literal", value: 2 },
        body,
      },
    };

    await expect(foldAST(interpreter, ast)).resolves.toEqual([
      [1, 7],
      [2, 7],
    ]);
    expect(counters.get("stable")).toBe(1);
  });
});
