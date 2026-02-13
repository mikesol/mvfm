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
