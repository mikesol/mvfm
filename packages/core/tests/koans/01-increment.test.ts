import { expect, test } from "vitest";

import { koan } from "../../src/index";

test("koan gate 01-increment: base26 id increment via core API", () => {
  expect(koan.incrementId("a")).toBe("b");
  expect(koan.incrementId("y")).toBe("z");
  expect(koan.incrementId("z")).toBe("aa");
  expect(koan.incrementId("az")).toBe("ba");
  expect(koan.incrementId("zz")).toBe("aaa");
});
