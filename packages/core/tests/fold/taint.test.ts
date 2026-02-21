import { expect, test } from "vitest";

import { koan } from "../../src/index";

test("fold taints volatile nodes and taint propagates to parents", async () => {
  const counts = { stable: 0, volatile: 0, parent: 0 };

  const adj = {
    s: { kind: "stable/lit", children: [], out: 10 },
    v: { kind: "st/get", children: [], out: undefined },
    p: { kind: "calc/mix", children: ["s", "v"], out: undefined },
    r: { kind: "calc/root", children: ["p", "p"], out: undefined },
  };

  const interp = {
    "stable/lit": async function* () {
      counts.stable += 1;
      yield* [];
      return 10;
    },
    "st/get": async function* () {
      counts.volatile += 1;
      yield* [];
      return counts.volatile;
    },
    "calc/mix": async function* () {
      counts.parent += 1;
      const stable = (yield 0) as number;
      const volatile = (yield 1) as number;
      return stable + volatile;
    },
    "calc/root": async function* () {
      const left = (yield 0) as number;
      const right = (yield 1) as number;
      return left + right;
    },
  };

  await expect(koan.fold<number>("r", adj, interp)).resolves.toBe(23);
  expect(counts).toEqual({ stable: 1, volatile: 2, parent: 2 });
});
