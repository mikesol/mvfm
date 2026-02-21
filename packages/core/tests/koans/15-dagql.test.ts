import { expect, test } from "vitest";

import { koan } from "../../src/index";

test("koan gate 15-dagql: pipe composes transforms with precise result", () => {
  const prog = koan.app(koan.mul(koan.add(3, 4), 5));
  const chained = koan.pipe(
    prog,
    (e) => koan.replaceWhere(e, koan.byKind("num/add"), "num/sub"),
    (e) => koan.spliceWhere(koan.commit(e), koan.isLeaf()),
  );

  expect(chained.__adj.c?.kind).toBe("num/sub");
  expect(chained.__adj.c?.children).toEqual([]);
  expect(chained.__adj.e?.children).toEqual(["c"]);
  expect("a" in chained.__adj).toBe(false);
  expect("d" in chained.__adj).toBe(false);
});
