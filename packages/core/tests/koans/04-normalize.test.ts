import { expect, test } from "vitest";

import { koan } from "../../src/index";

test("koan gate 04-normalize: createApp resolves traits and lifts literals", () => {
  const app = koan.createApp(...koan.stdPlugins, koan.ordPlugin);

  const ltProg = app(koan.lt(3, 4));
  expect(ltProg.__adj[ltProg.__id]?.kind).toBe("num/lt");

  const eqProg = app(koan.eq("a", "b"));
  expect(eqProg.__adj[eqProg.__id]?.kind).toBe("str/eq");

  const addProg = app(koan.add(1, 2));
  expect(addProg.__adj[addProg.__id]?.kind).toBe("num/add");
  expect(Object.keys(addProg.__adj).length).toBe(3);
});

test("koan gate 04-normalize: trait type mismatch fails", () => {
  const app = koan.createApp(...koan.stdPlugins);
  expect(() => app(koan.eq(3, "x"))).toThrow();
});

test("koan gate 04-normalize: nested arithmetic normalizes deterministically", () => {
  const app = koan.createApp(...koan.stdPlugins);
  const prog = app(koan.mul(koan.add(1, 2), 5));

  expect(prog.__adj[prog.__id]?.kind).toBe("num/mul");
  const children = prog.__adj[prog.__id]?.children as string[];
  expect(children).toHaveLength(2);
  expect(Object.keys(prog.__adj)).toHaveLength(5);
});
