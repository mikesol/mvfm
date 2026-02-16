import { describe, expect, it } from "vitest";
import type { TypedNode } from "../../src/fold";
import { createFoldState, foldAST } from "../../src/fold";
import { coreInterpreter } from "../../src/interpreters/core";
import { createTrackingInterpreter } from "./dag-memoization.shared";

describe("DAG memoization", () => {
  it("shared node evaluated once when used by two consumers in sequence", async () => {
    const { interpreter, visitCount } = createTrackingInterpreter();
    const state = createFoldState();

    const shared = { kind: "track/value", id: "shared", value: 5 } as TypedNode;
    const addA = {
      kind: "track/add",
      id: "addA",
      left: shared,
      right: { kind: "track/value", id: "lit10", value: 10 },
    } as TypedNode;
    const addB = {
      kind: "track/add",
      id: "addB",
      left: shared,
      right: { kind: "track/value", id: "lit20", value: 20 },
    } as TypedNode;
    const root = { kind: "track/pair", id: "root", a: addA, b: addB } as TypedNode;

    const result = await foldAST(interpreter, root, state);
    expect(result).toEqual([15, 25]);
    expect(visitCount.get("shared")).toBe(1);
  });

  it("diamond dependency: D used by B and C, both used by A", async () => {
    const { interpreter, visitCount } = createTrackingInterpreter();
    const state = createFoldState();

    const D = { kind: "track/value", id: "D", value: 3 } as TypedNode;
    const B = {
      kind: "track/add",
      id: "B",
      left: D,
      right: { kind: "track/value", id: "lit10", value: 10 },
    } as TypedNode;
    const C = {
      kind: "track/add",
      id: "C",
      left: D,
      right: { kind: "track/value", id: "lit20", value: 20 },
    } as TypedNode;
    const A = { kind: "track/pair", id: "A", a: B, b: C } as TypedNode;

    const result = await foldAST(interpreter, A, state);
    expect(result).toEqual([13, 23]);
    expect(visitCount.get("D")).toBe(1);
  });

  it("parallel evaluation with shared node", async () => {
    const { interpreter, visitCount } = createTrackingInterpreter();
    const state = createFoldState();

    const shared = { kind: "track/value", id: "shared", value: 7 } as TypedNode;
    const branchA = {
      kind: "track/add",
      id: "branchA",
      left: shared,
      right: { kind: "track/value", id: "lit1", value: 1 },
    } as TypedNode;
    const branchB = {
      kind: "track/add",
      id: "branchB",
      left: shared,
      right: { kind: "track/value", id: "lit2", value: 2 },
    } as TypedNode;
    const root = {
      kind: "track/parallel",
      id: "root",
      elements: [branchA, branchB],
    } as TypedNode;

    const result = await foldAST(interpreter, root, state);
    expect(result).toEqual([8, 9]);
    expect(visitCount.get("shared")).toBe(1);
  });
});

describe("DAG memoization: taint tracking", () => {
  it("volatile node (lambda_param) is not cached", async () => {
    const { interpreter } = createTrackingInterpreter();
    const combined = { ...coreInterpreter, ...interpreter };
    const state = createFoldState();

    const param = { kind: "core/lambda_param", name: "x" } as any as TypedNode;
    (param as any).__value = 42;

    const root = {
      kind: "track/add",
      left: param,
      right: { kind: "track/value", value: 1, id: "one" },
      id: "root",
    } as TypedNode;

    const result = await foldAST(combined, root, state);
    expect(result).toBe(43);

    (param as any).__value = 100;
    const result2 = await foldAST(combined, root, state);
    expect(result2).toBe(101);
  });

  it("taint propagates: node depending on volatile is not cached, independent node is cached", async () => {
    const { interpreter, visitCount } = createTrackingInterpreter();
    const combined = { ...coreInterpreter, ...interpreter };
    const state = createFoldState();

    const param = { kind: "core/lambda_param", name: "x" } as any as TypedNode;
    (param as any).__value = 10;

    const addNode = {
      kind: "track/add",
      left: param,
      right: { kind: "track/value", value: 5, id: "five" },
      id: "add",
    } as TypedNode;
    const stable = { kind: "track/value", value: 99, id: "stable" } as TypedNode;
    const root = { kind: "track/pair", a: addNode, b: stable, id: "root" } as TypedNode;

    await foldAST(combined, root, state);
    expect(visitCount.get("stable")).toBe(1);

    (param as any).__value = 20;
    const result2 = await foldAST(combined, root, state);
    expect(result2).toEqual([25, 99]);
    expect(visitCount.get("stable")).toBe(1);
    expect(visitCount.get("add")).toBe(2);
  });

  it("independent branch is cached even when sibling is tainted", async () => {
    const { interpreter, visitCount } = createTrackingInterpreter();
    const combined = { ...coreInterpreter, ...interpreter };
    const state = createFoldState();

    const param = { kind: "core/lambda_param", name: "x" } as any as TypedNode;
    (param as any).__value = 1;

    const taintedBranch = {
      kind: "track/add",
      left: param,
      right: { kind: "track/value", value: 0, id: "zero" },
      id: "tainted",
    } as TypedNode;
    const stableBranch = { kind: "track/value", value: 42, id: "stable" } as TypedNode;
    const root = { kind: "track/pair", a: taintedBranch, b: stableBranch, id: "root" } as TypedNode;

    await foldAST(combined, root, state);
    (param as any).__value = 2;
    await foldAST(combined, root, state);
    (param as any).__value = 3;
    await foldAST(combined, root, state);

    expect(visitCount.get("tainted")).toBe(3);
    expect(visitCount.get("stable")).toBe(1);
  });
});

describe("DAG memoization: adversarial cases", () => {
  it("same node referenced in both tainted and untainted positions", async () => {
    const { interpreter, visitCount } = createTrackingInterpreter();
    const combined = { ...coreInterpreter, ...interpreter };
    const state = createFoldState();

    const shared = { kind: "track/value", value: 42, id: "shared" } as TypedNode;
    const param = { kind: "core/lambda_param", name: "x" } as any as TypedNode;
    (param as any).__value = 1;

    const taintedUse = {
      kind: "track/add",
      left: param,
      right: shared,
      id: "tainted-use",
    } as TypedNode;
    const cleanUse = {
      kind: "track/add",
      left: shared,
      right: { kind: "track/value", value: 0, id: "zero" },
      id: "clean-use",
    } as TypedNode;
    const root = { kind: "track/pair", a: taintedUse, b: cleanUse, id: "root" } as TypedNode;

    const result = await foldAST(combined, root, state);
    expect(result).toEqual([43, 42]);
    expect(visitCount.get("shared")).toBe(1);

    (param as any).__value = 100;
    const result2 = await foldAST(combined, root, state);
    expect(result2).toEqual([142, 42]);
    expect(visitCount.get("shared")).toBe(1);
    expect(visitCount.get("tainted-use")).toBe(2);
    expect(visitCount.get("clean-use")).toBe(1);
  });

  it("long prop_access chain is fully cached", async () => {
    const { interpreter, visitCount } = createTrackingInterpreter();
    const combined = { ...coreInterpreter, ...interpreter };
    const state = createFoldState();

    const query = {
      kind: "track/value",
      value: [{ items: [{ name: "hello" }] }],
      id: "query",
    } as TypedNode;
    const access0 = { kind: "core/prop_access", object: query, property: 0 } as TypedNode;
    const accessItems = {
      kind: "core/prop_access",
      object: access0,
      property: "items",
    } as TypedNode;
    const accessItem0 = { kind: "core/prop_access", object: accessItems, property: 0 } as TypedNode;
    const accessName = {
      kind: "core/prop_access",
      object: accessItem0,
      property: "name",
    } as TypedNode;

    const root = { kind: "track/pair", a: accessName, b: accessName, id: "root" } as TypedNode;

    const result = await foldAST(combined, root, state);
    expect(result).toEqual(["hello", "hello"]);
    expect(visitCount.get("query")).toBe(1);
  });

  it("cache handles rejected promises correctly", async () => {
    let callCount = 0;
    const failInterpreter: Interpreter = {
      // biome-ignore lint/correctness/useYield: test handler throws immediately
      "fx/flaky": async function* () {
        callCount++;
        throw new Error("boom");
      },
    };

    const combined = { ...failInterpreter, ...coreInterpreter };
    const state = createFoldState();

    const node = { kind: "fx/flaky" } as TypedNode;
    await expect(foldAST(combined, node, state)).rejects.toThrow("boom");
    await expect(foldAST(combined, node, state)).rejects.toThrow("boom");
    expect(callCount).toBe(2);
  });

  it("deeply nested shared node in parallel branches", async () => {
    const { interpreter, visitCount } = createTrackingInterpreter();
    const state = createFoldState();

    const deep = { kind: "track/value", value: 1, id: "deep" } as TypedNode;
    const mid1 = {
      kind: "track/add",
      left: deep,
      right: { kind: "track/value", value: 2, id: "l2a" },
      id: "mid1",
    } as TypedNode;
    const mid2 = {
      kind: "track/add",
      left: deep,
      right: { kind: "track/value", value: 3, id: "l2b" },
      id: "mid2",
    } as TypedNode;
    const root = { kind: "track/parallel", elements: [mid1, mid2], id: "root" } as TypedNode;

    const result = await foldAST(interpreter, root, state);
    expect(result).toEqual([3, 4]);
    expect(visitCount.get("deep")).toBe(1);
  });
});
