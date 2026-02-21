import { expect, test } from "vitest";

import { koan } from "../../src/index";

test("koan gate 03-traits: trait constructors are available via composition", () => {
  const $ = koan.mvfmU(...koan.stdPlugins);

  expect($.add(1, 2).__kind).toBe("num/add");
  expect($.eq(1, 2).__kind).toBe("eq");
  expect($.eq("a", "b").__kind).toBe("eq");
  expect($.eq(true, false).__kind).toBe("eq");
});
