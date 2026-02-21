import { expect, test } from "vitest";

import { koan } from "../../src/index";

test("koan gate 07-map: mapWhere rewrites matched nodes and preserves the rest", () => {
  const prog = koan.app(koan.mul(koan.add(3, 4), 5));
  const mapped = koan.mapWhere(prog, koan.byKind("num/add"), (entry) => ({
    kind: "num/sub",
    children: entry.children,
    out: entry.out,
  }));

  expect(mapped.__adj.c?.kind).toBe("num/sub");
  expect(mapped.__adj.a?.kind).toBe("num/literal");
  expect(mapped.__adj.e?.kind).toBe("num/mul");
  expect(mapped.__id).toBe("e");
});
