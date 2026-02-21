import { expect, test } from "vitest";

import { koan } from "../../src/index";

test("koan gate 13-splice: spliceWhere removes wrappers and reconnects children", () => {
  const prog = koan.app(koan.mul(koan.add(3, 4), 5));
  const wrapped = koan.commit(koan.wrapByName(prog, "c", "debug/wrap"));
  const spliced = koan.spliceWhere(wrapped, koan.byKind("debug/wrap"));

  expect(spliced.__adj.e?.children).toEqual(["c", "d"]);
  expect(spliced.__adj.c?.kind).toBe("num/add");
  expect("f" in spliced.__adj).toBe(false);
  expect(spliced.__id).toBe("e");
});
