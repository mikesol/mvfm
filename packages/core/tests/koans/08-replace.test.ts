import { expect, test } from "vitest";

import { koan } from "../../src/index";

test("koan gate 08-replace: replaceWhere swaps kind and preserves shape", () => {
  const prog = koan.app(koan.mul(koan.add(3, 4), 5));
  const replaced = koan.commit(koan.replaceWhere(prog, koan.byKind("num/add"), "num/sub"));

  expect(replaced.__adj.c?.kind).toBe("num/sub");
  expect(replaced.__adj.c?.children).toEqual(["a", "b"]);
  expect(replaced.__adj.a?.kind).toBe("num/literal");
  expect(replaced.__id).toBe("e");
});
