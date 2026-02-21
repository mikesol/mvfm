import { expect, test } from "vitest";

import { koan } from "../../src/index";

test("koan gate 02-build: constructor surface via core API", () => {
  expect(koan.add(1, 2).__kind).toBe("num/add");
  expect(koan.mul(3, 4).__kind).toBe("num/mul");
  expect(koan.sub(5, 1).__kind).toBe("num/sub");
  expect(koan.eq(1, 1).__kind).toBe("eq");

  expect(koan.numLit(42)).toBe(42);
  expect(koan.strLit("x")).toBe("x");
  expect(koan.boolLit(true)).toBe(true);
});
