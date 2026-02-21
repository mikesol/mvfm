import { expect, test } from "vitest";

import { koan } from "../../src/index";

test("koan gate 12-wrap: wrapByName inserts wrapper and rewires parents", () => {
  const prog = koan.app(koan.mul(koan.add(3, 4), 5));
  const wrapped = koan.commit(koan.wrapByName(prog, "c", "debug/wrap"));

  expect(wrapped.__adj.f?.kind).toBe("debug/wrap");
  expect(wrapped.__adj.f?.children).toEqual(["c"]);
  expect(wrapped.__adj.e?.children).toEqual(["f", "d"]);
  expect(wrapped.__id).toBe("e");
  expect(wrapped.__counter).toBe("g");
});
