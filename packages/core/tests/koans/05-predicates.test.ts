import { expect, test } from "vitest";

import { koan } from "../../src/index";

test("koan gate 05-predicates: runtime predicate combinators match normalized nodes", () => {
  const prog = koan.app(koan.mul(koan.add(3, 4), 5));
  const adj = prog.__adj;

  const rootId = prog.__id;
  const root = adj[rootId];
  if (!root) throw new Error("missing root");

  expect(koan.byKind("num/mul").test(root, rootId, adj)).toBe(true);
  expect(koan.isLeaf().test(root, rootId, adj)).toBe(false);
  expect(koan.hasChildCount(2).test(root, rootId, adj)).toBe(true);
  expect(koan.byKindGlob("num/").test(root, rootId, adj)).toBe(true);

  const addId = root.children[0];
  const addEntry = adj[addId];
  if (!addEntry) throw new Error("missing add entry");
  expect(koan.and(koan.byKind("num/add"), koan.not(koan.isLeaf())).test(addEntry, addId, adj)).toBe(
    true,
  );

  const aliasAdj = {
    ...adj,
    "@target": { kind: "@alias", children: [addId], out: undefined },
  };
  expect(koan.byName("target").test(addEntry, addId, aliasAdj)).toBe(true);
});
