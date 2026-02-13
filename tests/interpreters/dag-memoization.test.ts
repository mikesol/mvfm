import { describe, expect, it } from "vitest";
import { type ASTNode, composeInterpreters, type InterpreterFragment } from "../../src/core";
import { coreInterpreter } from "../../src/interpreters/core";
import { errorInterpreter } from "../../src/plugins/error/interpreter";
import { fiberInterpreter } from "../../src/plugins/fiber/interpreter";

function createTrackingFragment(): {
  fragment: InterpreterFragment;
  visitCount: Map<string, number>;
} {
  const visitCount = new Map<string, number>();
  return {
    visitCount,
    fragment: {
      pluginName: "track",
      canHandle: (node) => node.kind.startsWith("track/"),
      async visit(node: ASTNode, recurse: (n: ASTNode) => Promise<unknown>) {
        const id = (node as any).id as string;
        visitCount.set(id, (visitCount.get(id) ?? 0) + 1);
        switch (node.kind) {
          case "track/value":
            return node.value;
          case "track/add": {
            const left = (await recurse(node.left as ASTNode)) as number;
            const right = (await recurse(node.right as ASTNode)) as number;
            return left + right;
          }
          case "track/pair": {
            const a = await recurse(node.a as ASTNode);
            const b = await recurse(node.b as ASTNode);
            return [a, b];
          }
          case "track/parallel": {
            const elements = node.elements as ASTNode[];
            return Promise.all(elements.map((e) => recurse(e)));
          }
          default:
            throw new Error(`Unknown track node: ${node.kind}`);
        }
      },
    },
  };
}

describe("DAG memoization", () => {
  it("shared node evaluated once when used by two consumers in sequence", async () => {
    const { fragment, visitCount } = createTrackingFragment();
    const recurse = composeInterpreters([fragment]);

    const shared: ASTNode = { kind: "track/value", id: "shared", value: 5 };
    const addA: ASTNode = {
      kind: "track/add",
      id: "addA",
      left: shared,
      right: { kind: "track/value", id: "lit10", value: 10 } as ASTNode,
    };
    const addB: ASTNode = {
      kind: "track/add",
      id: "addB",
      left: shared,
      right: { kind: "track/value", id: "lit20", value: 20 } as ASTNode,
    };
    const root: ASTNode = { kind: "track/pair", id: "root", a: addA, b: addB };

    const result = await recurse(root);
    expect(result).toEqual([15, 25]);
    expect(visitCount.get("shared")).toBe(1);
  });

  it("diamond dependency: D used by B and C, both used by A", async () => {
    const { fragment, visitCount } = createTrackingFragment();
    const recurse = composeInterpreters([fragment]);

    const D: ASTNode = { kind: "track/value", id: "D", value: 3 };
    const B: ASTNode = {
      kind: "track/add",
      id: "B",
      left: D,
      right: { kind: "track/value", id: "lit10", value: 10 } as ASTNode,
    };
    const C: ASTNode = {
      kind: "track/add",
      id: "C",
      left: D,
      right: { kind: "track/value", id: "lit20", value: 20 } as ASTNode,
    };
    const A: ASTNode = { kind: "track/pair", id: "A", a: B, b: C };

    const result = await recurse(A);
    expect(result).toEqual([13, 23]);
    expect(visitCount.get("D")).toBe(1);
  });

  it("parallel evaluation with shared node (Promise.all)", async () => {
    const { fragment, visitCount } = createTrackingFragment();
    const recurse = composeInterpreters([fragment]);

    const shared: ASTNode = { kind: "track/value", id: "shared", value: 7 };
    const branchA: ASTNode = {
      kind: "track/add",
      id: "branchA",
      left: shared,
      right: { kind: "track/value", id: "lit1", value: 1 } as ASTNode,
    };
    const branchB: ASTNode = {
      kind: "track/add",
      id: "branchB",
      left: shared,
      right: { kind: "track/value", id: "lit2", value: 2 } as ASTNode,
    };
    const root: ASTNode = {
      kind: "track/parallel",
      id: "root",
      elements: [branchA, branchB],
    };

    const result = await recurse(root);
    expect(result).toEqual([8, 9]);
    expect(visitCount.get("shared")).toBe(1);
  });
});

describe("DAG memoization: taint tracking", () => {
  it("volatile node (lambda_param) is not cached", async () => {
    const { fragment } = createTrackingFragment();
    const interp = composeInterpreters([coreInterpreter, fragment]);

    const param: ASTNode = { kind: "core/lambda_param", name: "x" } as any;
    (param as any).__value = 42;

    const root: ASTNode = {
      kind: "track/add",
      left: param,
      right: { kind: "track/value", value: 1, id: "one" },
      id: "root",
    };

    const result = await interp(root);
    expect(result).toBe(43);

    // Change value and re-evaluate — root depends on volatile, so re-evaluates
    (param as any).__value = 100;
    const result2 = await interp(root);
    expect(result2).toBe(101);
  });

  it("taint propagates: node depending on volatile is not cached, independent node is cached", async () => {
    const { fragment, visitCount } = createTrackingFragment();
    const interp = composeInterpreters([coreInterpreter, fragment]);

    const param: ASTNode = { kind: "core/lambda_param", name: "x" } as any;
    (param as any).__value = 10;

    const addNode: ASTNode = {
      kind: "track/add",
      left: param,
      right: { kind: "track/value", value: 5, id: "five" },
      id: "add",
    };
    const stable: ASTNode = { kind: "track/value", value: 99, id: "stable" };
    const root: ASTNode = { kind: "track/pair", a: addNode, b: stable, id: "root" };

    await interp(root);
    expect(visitCount.get("stable")).toBe(1);

    (param as any).__value = 20;
    const result2 = await interp(root);
    expect(result2).toEqual([25, 99]);
    expect(visitCount.get("stable")).toBe(1); // still cached
    expect(visitCount.get("add")).toBe(2); // re-evaluated
  });

  it("independent branch is cached even when sibling is tainted", async () => {
    const { fragment, visitCount } = createTrackingFragment();
    const interp = composeInterpreters([coreInterpreter, fragment]);

    const param: ASTNode = { kind: "core/lambda_param", name: "x" } as any;
    (param as any).__value = 1;

    const taintedBranch: ASTNode = {
      kind: "track/add",
      left: param,
      right: { kind: "track/value", value: 0, id: "zero" },
      id: "tainted",
    };
    const stableBranch: ASTNode = { kind: "track/value", value: 42, id: "stable" };
    const root: ASTNode = { kind: "track/pair", a: taintedBranch, b: stableBranch, id: "root" };

    await interp(root);
    (param as any).__value = 2;
    await interp(root);
    (param as any).__value = 3;
    await interp(root);

    expect(visitCount.get("tainted")).toBe(3); // re-evaluated each time
    expect(visitCount.get("stable")).toBe(1); // cached from first evaluation
  });
});

describe("DAG memoization: adversarial cases", () => {
  it("same node referenced in both tainted and untainted positions", async () => {
    // shared is used both as a sibling to a volatile node (tainted path)
    // and independently (untainted path). Should be cached.
    const { fragment, visitCount } = createTrackingFragment();
    const interp = composeInterpreters([coreInterpreter, fragment]);

    const shared: ASTNode = { kind: "track/value", value: 42, id: "shared" };
    const param: ASTNode = { kind: "core/lambda_param", name: "x" } as any;
    (param as any).__value = 1;

    // tainted path: add(param, shared) — param is volatile
    const taintedUse: ASTNode = {
      kind: "track/add",
      left: param,
      right: shared,
      id: "tainted-use",
    };
    // untainted path: add(shared, literal)
    const cleanUse: ASTNode = {
      kind: "track/add",
      left: shared,
      right: { kind: "track/value", value: 0, id: "zero" },
      id: "clean-use",
    };
    const root: ASTNode = { kind: "track/pair", a: taintedUse, b: cleanUse, id: "root" };

    const result = await interp(root);
    expect(result).toEqual([43, 42]);
    expect(visitCount.get("shared")).toBe(1); // cached, used in both paths

    // Change volatile, re-evaluate
    (param as any).__value = 100;
    const result2 = await interp(root);
    expect(result2).toEqual([142, 42]);
    expect(visitCount.get("shared")).toBe(1); // still cached
    expect(visitCount.get("tainted-use")).toBe(2); // re-evaluated
    expect(visitCount.get("clean-use")).toBe(1); // cached
  });

  it("long prop_access chain is fully cached", async () => {
    const { fragment, visitCount } = createTrackingFragment();
    const interp = composeInterpreters([coreInterpreter, fragment]);

    // Simulate: config[0].items[0].name via nested prop_access
    const query: ASTNode = {
      kind: "track/value",
      value: [{ items: [{ name: "hello" }] }],
      id: "query",
    };
    const access0: ASTNode = { kind: "core/prop_access", object: query, property: 0 };
    const accessItems: ASTNode = { kind: "core/prop_access", object: access0, property: "items" };
    const accessItem0: ASTNode = { kind: "core/prop_access", object: accessItems, property: 0 };
    const accessName: ASTNode = { kind: "core/prop_access", object: accessItem0, property: "name" };

    // Use the end of the chain twice
    const root: ASTNode = { kind: "track/pair", a: accessName, b: accessName, id: "root" };

    const result = await interp(root);
    expect(result).toEqual(["hello", "hello"]);
    expect(visitCount.get("query")).toBe(1); // query evaluated once
  });

  it("cache handles rejected promises correctly", async () => {
    let callCount = 0;
    const failOnce: InterpreterFragment = {
      pluginName: "fx",
      canHandle: (node) => node.kind === "fx/flaky",
      async visit() {
        callCount++;
        throw new Error("boom");
      },
    };

    const interp = composeInterpreters([failOnce, coreInterpreter]);

    const node: ASTNode = { kind: "fx/flaky" };
    await expect(interp(node)).rejects.toThrow("boom");
    // Second call: same node, should return cached rejected promise
    await expect(interp(node)).rejects.toThrow("boom");
    expect(callCount).toBe(1); // cached, not re-executed
  });

  it("deeply nested shared node in parallel branches", async () => {
    const { fragment, visitCount } = createTrackingFragment();
    const interp = composeInterpreters([fragment]);

    const deep: ASTNode = { kind: "track/value", value: 1, id: "deep" };
    const mid1: ASTNode = {
      kind: "track/add",
      left: deep,
      right: { kind: "track/value", value: 2, id: "l2a" },
      id: "mid1",
    };
    const mid2: ASTNode = {
      kind: "track/add",
      left: deep,
      right: { kind: "track/value", value: 3, id: "l2b" },
      id: "mid2",
    };
    // mid1 and mid2 share "deep", run in parallel
    const root: ASTNode = { kind: "track/parallel", elements: [mid1, mid2], id: "root" };

    const result = await interp(root);
    expect(result).toEqual([3, 4]);
    expect(visitCount.get("deep")).toBe(1);
  });
});

describe("DAG memoization: retry with fresh cache", () => {
  it("retry re-executes on each attempt (not cached)", async () => {
    let callCount = 0;
    const sideEffectFragment: InterpreterFragment = {
      pluginName: "fx",
      canHandle: (node) => node.kind === "fx/call",
      async visit(_node: ASTNode, _recurse: (n: ASTNode) => Promise<unknown>) {
        callCount++;
        if (callCount < 3) throw new Error("not yet");
        return "success";
      },
    };

    const interp = composeInterpreters([
      sideEffectFragment,
      fiberInterpreter,
      errorInterpreter,
      coreInterpreter,
    ]);

    const result = await interp({
      kind: "fiber/retry",
      expr: { kind: "fx/call" },
      attempts: 5,
      delay: 0,
    });

    expect(result).toBe("success");
    expect(callCount).toBe(3); // called 3 times, not 1
  });

  it("retry exhausts attempts when all fail", async () => {
    let callCount = 0;
    const alwaysFails: InterpreterFragment = {
      pluginName: "fx",
      canHandle: (node) => node.kind === "fx/call",
      async visit() {
        callCount++;
        throw new Error("always fails");
      },
    };

    const interp = composeInterpreters([
      alwaysFails,
      fiberInterpreter,
      errorInterpreter,
      coreInterpreter,
    ]);

    await expect(
      interp({ kind: "fiber/retry", expr: { kind: "fx/call" }, attempts: 3, delay: 0 }),
    ).rejects.toThrow("always fails");
    expect(callCount).toBe(3);
  });
});
