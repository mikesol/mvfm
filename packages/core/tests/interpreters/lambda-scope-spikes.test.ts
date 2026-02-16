import { describe, expect, it } from "vitest";
import {
  type Node,
  param,
  runApproachA,
  runApproachB,
  runApproachC,
} from "./lambda-scope-spikes-runtime";

describe("lambda scope spikes", () => {
  const approaches = [
    ["A: recurse_scoped effect", runApproachA],
    ["B: core/apply_lambda node", runApproachB],
    ["C: env-aware contract", runApproachC],
  ] as const;

  it.each(approaches)("%s preserves lexical shadowing by param identity", (_name, run) => {
    const outer = param(1, "x");
    const inner = param(2, "x");
    const ast: Node = {
      kind: "spike/invoke",
      lambda: {
        param: outer,
        body: {
          kind: "core/tuple",
          elements: [
            outer,
            {
              kind: "spike/invoke",
              lambda: { param: inner, body: inner },
              arg: { kind: "core/literal", value: 99 },
            },
          ],
        },
      },
      arg: { kind: "core/literal", value: 10 },
    };

    expect(run(ast, new Map())).toEqual([10, 99]);
  });

  it.each(
    approaches,
  )("%s reuses stable subnodes across repeated lambda applications", (_name, run) => {
    const p = param(3, "item");
    const counters = new Map<string, number>();
    const ast: Node = {
      kind: "spike/par_map",
      collection: { kind: "core/literal", value: [1, 2, 3] },
      param: p,
      body: {
        kind: "num/add",
        left: p,
        right: { kind: "spike/counted", id: "stable", value: 100 },
      },
    };

    expect(run(ast, counters)).toEqual([101, 102, 103]);
    expect(counters.get("stable")).toBe(1);
  });

  it.each(approaches)("%s applies lexical binding for try/catch lambda", (_name, run) => {
    const err = param(4, "err");
    const ast: Node = {
      kind: "spike/try",
      expr: { kind: "spike/throw", error: { kind: "core/literal", value: "boom" } },
      catch: { param: err, body: { kind: "core/tuple", elements: [err, err] } },
    };

    expect(run(ast, new Map())).toEqual(["boom", "boom"]);
  });
});
