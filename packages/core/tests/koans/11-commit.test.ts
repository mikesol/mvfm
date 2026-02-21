import { expect, test } from "vitest";

import { koan } from "../../src/index";

test("koan gate 11-commit: gc + commit validates and strips unreachable nodes", () => {
  const prog = koan.app(koan.mul(koan.add(3, 4), 5));
  const d0 = koan.dirty(prog);
  const d1 = koan.addEntry(d0, "orphan", { kind: "dead", children: [], out: undefined });
  const d2 = koan.gc(d1);
  const committed = koan.commit(d2);

  expect("orphan" in committed.__adj).toBe(false);
  expect(committed.__adj[committed.__id]?.kind).toBe("num/mul");

  expect(() => koan.commit(koan.removeEntry(koan.dirty(prog), "a"))).toThrow();
});
