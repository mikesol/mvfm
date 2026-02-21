import { expect, test } from "vitest";

import { koan } from "../../src/index";

test("koan gate 06-select: selectWhere returns matching node ids", () => {
  const prog = koan.app(koan.mul(koan.add(3, 4), 5));

  const adds = koan.selectWhere(prog, koan.byKind("num/add"));
  expect(Array.from(adds)).toEqual(["c"]);

  const leaves = koan.selectWhere(prog, koan.isLeaf());
  expect(Array.from(leaves).sort()).toEqual(["a", "b", "d"]);

  const branches = koan.selectWhere(prog, koan.not(koan.isLeaf()));
  expect(Array.from(branches).sort()).toEqual(["c", "e"]);
});
