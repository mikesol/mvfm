import { expect, test } from "vitest";

import { koan } from "../../src/index";

test("fold resolves core/lambda_param via recurse_scoped binding", async () => {
  const adj = {
    x: { kind: "core/lambda_param", children: [], out: undefined },
    r: { kind: "scope/root", children: ["x"], out: undefined },
  };

  const interp = {
    "scope/root": async function* () {
      return (yield {
        type: "recurse_scoped",
        child: 0,
        bindings: [{ paramId: "x", value: 42 }],
      }) as number;
    },
  };

  await expect(koan.fold<number>("r", adj, interp)).resolves.toBe(42);
});

test("fold scope stack shadows outer bindings", async () => {
  const adj = {
    x: { kind: "core/lambda_param", children: [], out: undefined },
    inner: { kind: "scope/inner", children: ["x"], out: undefined },
    outer: { kind: "scope/outer", children: ["inner"], out: undefined },
  };

  const interp = {
    "scope/inner": async function* () {
      return (yield {
        type: "recurse_scoped",
        child: 0,
        bindings: [{ paramId: "x", value: 2 }],
      }) as number;
    },
    "scope/outer": async function* () {
      return (yield {
        type: "recurse_scoped",
        child: 0,
        bindings: [{ paramId: "x", value: 1 }],
      }) as number;
    },
  };

  await expect(koan.fold<number>("outer", adj, interp)).resolves.toBe(2);
});
