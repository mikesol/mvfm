import { expect, test } from "vitest";

import { koan } from "../../src/index";

test("koan gate 00-expr: CExpr/NExpr primitives via core API", () => {
  const c = koan.makeCExpr<number, "num/add", [number, number]>("num/add", [1, 2]);
  expect(c.__kind).toBe("num/add");
  expect(koan.isCExpr(c)).toBe(true);
  expect(koan.isCExpr({})).toBe(false);

  const n = koan.makeNExpr<
    number,
    "a",
    { a: { kind: "num/literal"; children: []; out: number } },
    "b"
  >("a", { a: { kind: "num/literal", children: [], out: 1 } }, "b");

  expect(n.__id).toBe("a");
  expect(n.__counter).toBe("b");
  expect(n.__adj.a.kind).toBe("num/literal");
});
