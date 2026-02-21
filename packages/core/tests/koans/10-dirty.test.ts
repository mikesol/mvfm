import { expect, test } from "vitest";

import { koan } from "../../src/index";

test("koan gate 10-dirty: dirty mutators update adj and root in sequence", () => {
  const prog = koan.app(koan.mul(koan.add(3, 4), 5));
  const d0 = koan.dirty(prog);
  const d1 = koan.addEntry(d0, "f", { kind: "debug/log", children: ["e"], out: undefined });
  const d2 = koan.swapEntry(d1, "c", { kind: "num/sub", children: ["a", "b"], out: 0 });
  const d3 = koan.rewireChildren(d2, "a", "b");
  const d4 = koan.removeEntry(d3, "a");
  const d5 = koan.setRoot(d4, "f");

  expect(d5.__id).toBe("f");
  expect(d5.__adj.f?.kind).toBe("debug/log");
  expect(d5.__adj.c?.kind).toBe("num/sub");
  expect(d5.__adj.c?.children).toEqual(["b", "b"]);
  expect("a" in d5.__adj).toBe(false);
});
