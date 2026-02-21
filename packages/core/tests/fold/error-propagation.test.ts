import { expect, test } from "vitest";

import { koan } from "../../src/index";

test("fold propagates child errors to parent generator via gen.throw", async () => {
  const adj = {
    bad: { kind: "throw/child", children: [], out: undefined },
    root: { kind: "catch/parent", children: ["bad"], out: undefined },
  };

  const interp = {
    "throw/child": async function* () {
      yield* [];
      throw new Error("boom");
    },
    "catch/parent": async function* () {
      try {
        return (yield 0) as number;
      } catch {
        return "fallback";
      }
    },
  };

  await expect(koan.fold<string>("root", adj, interp)).resolves.toBe("fallback");
});

test("fold rejects when a node kind has no handler", async () => {
  await expect(
    koan.fold("root", { root: { kind: "missing/handler", children: [], out: undefined } }, {}),
  ).rejects.toThrow('fold: no handler for "missing/handler"');
});

test("fold rejects when a yielded child node is missing", async () => {
  await expect(
    koan.fold(
      "root",
      { root: { kind: "need/child", children: ["missing"], out: undefined } },
      {
        "need/child": async function* () {
          return yield 0;
        },
      },
    ),
  ).rejects.toThrow('fold: missing node "missing"');
});
