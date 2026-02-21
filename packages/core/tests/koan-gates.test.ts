/**
 * Koan gates — now split into focused test files:
 * - koan-gates-basic.test.ts  (00-05: expr, increment, build, traits, composition, predicates)
 * - koan-gates-ops.test.ts    (06-10: select, map, replace, gc, dirty)
 * - koan-gates-commit.test.ts (11-15: commit, wrap, splice, named, dagql)
 * - koan-gates-fold.test.ts   (16: bridge/fold)
 *
 * This file is kept as a placeholder. All tests import from ../../src/index
 * (the rebuilt core), not from __koans__/.
 */
import { describe, test } from "vitest";

describe("koan gates", () => {
  test("split into koan-gates-*.test.ts files", () => {
    // See koan-gates-basic.test.ts, koan-gates-ops.test.ts,
    // koan-gates-commit.test.ts, koan-gates-fold.test.ts
  });
});
