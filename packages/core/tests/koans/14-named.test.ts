import { expect, test } from "vitest";

import { koan } from "../../src/index";

test("koan gate 14-named: aliases select/replace target and alias-aware gc preserves @keys", () => {
  const prog = koan.app(koan.mul(koan.add(3, 4), 5));
  const named = koan.name(prog, "the-sum", "c");

  expect(named.__adj["@the-sum"]?.kind).toBe("@alias");

  const selected = koan.selectWhere(named, koan.byName("the-sum"));
  expect(Array.from(selected)).toEqual(["c"]);

  const replaced = koan.commit(koan.replaceWhere(named, koan.byName("the-sum"), "num/sub"));
  expect(replaced.__adj.c?.kind).toBe("num/sub");

  const dropped = koan.commit(koan.gc(koan.dirty(named)));
  expect("@the-sum" in dropped.__adj).toBe(false);

  const kept = koan.commit(koan.gcPreservingAliases(koan.dirty(named)));
  expect("@the-sum" in kept.__adj).toBe(true);
});
