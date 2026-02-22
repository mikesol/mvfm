/**
 * DagQL-Fu Predicates: Select, Replace, Map, Wrap, Splice operations.
 *
 * Exercises DagQL query and transformation operations through the front-door
 * pipeline: mvfm -> app -> Program -> pipe/dagql -> fold
 *
 * Phases 1-5: Baseline fold, Select with predicates, Replace, Map,
 * Wrap + splice round-trip.
 */

import { describe, expect, test } from "vitest";
import {
  and,
  byKind,
  byKindGlob,
  commit,
  defaults,
  fold,
  hasChildCount,
  injectInput,
  isLeaf,
  mapWhere,
  mvfm,
  not,
  or,
  prelude,
  replaceWhere,
  selectWhere,
  spliceWhere,
  wrapByName,
} from "../src/index";

describe("dagql-fu predicates", () => {
  const app = mvfm(prelude);

  // (x + 3) * (x - 1)  with x=7 -> (10)*(6) = 60
  const prog = () => {
    const p = app({ x: "number" }, ($: any) => {
      return $.mul($.add($.input.x, 3), $.sub($.input.x, 1));
    });
    return injectInput(p, { x: 7 });
  };

  // -- Phase 1: Baseline fold --
  test("baseline: (7+3)*(7-1) = 60", async () => {
    expect(await fold(defaults(app), prog())).toBe(60);
  });

  // -- Phase 2: Select with predicates --
  test("select: find all num/* nodes", () => {
    const nexpr = prog().__nexpr;
    const all = selectWhere(nexpr, byKindGlob("num/"));
    expect(all.size).toBeGreaterThanOrEqual(5);
  });

  test("select: isLeaf finds literals and inputs", () => {
    const nexpr = prog().__nexpr;
    const leaves = selectWhere(nexpr, isLeaf());
    expect(leaves.size).toBeGreaterThanOrEqual(2);
  });

  test("select: compound predicate -- binary num ops", () => {
    const nexpr = prog().__nexpr;
    const binary = selectWhere(nexpr, and(byKindGlob("num/"), hasChildCount(2)));
    expect(binary.size).toBeGreaterThanOrEqual(3);
  });

  test("select: or predicate", () => {
    const nexpr = prog().__nexpr;
    const addOrSub = selectWhere(nexpr, or(byKind("num/add"), byKind("num/sub")));
    expect(addOrSub.size).toBe(2);
  });

  test("select: not(isLeaf) finds non-leaf nodes", () => {
    const nexpr = prog().__nexpr;
    const inner = selectWhere(nexpr, not(isLeaf()));
    expect(inner.size).toBeGreaterThanOrEqual(3);
  });

  // -- Phase 3: Replace --
  test("replace: swap add->sub changes result", async () => {
    const nexpr = prog().__nexpr;
    const swapped = replaceWhere(nexpr, byKind("num/add"), "num/sub");
    expect(await fold(commit(swapped), defaults(app))).toBe(24);
  });

  test("replace: swap mul->add changes result", async () => {
    const nexpr = prog().__nexpr;
    const swapped = replaceWhere(nexpr, byKind("num/mul"), "num/add");
    expect(await fold(commit(swapped), defaults(app))).toBe(16);
  });

  // -- Phase 4: Map --
  test("map: rename add to sub preserving children", async () => {
    const nexpr = prog().__nexpr;
    const mapped = mapWhere(nexpr, byKind("num/add"), (e) => ({
      kind: "num/sub" as const,
      children: e.children,
      out: e.out,
    }));
    expect(await fold(commit(mapped), defaults(app))).toBe(24);
  });

  test("map: compound predicate -- rename all binary num ops to add", async () => {
    const nexpr = prog().__nexpr;
    const mapped = mapWhere(nexpr, and(byKindGlob("num/"), hasChildCount(2)), (e) => ({
      kind: "num/add" as const,
      children: e.children,
      out: e.out,
    }));
    expect(await fold(commit(mapped), defaults(app))).toBe(18);
  });

  // -- Phase 5: Wrap + splice round-trip --
  test("wrap then splice restores original result", async () => {
    const nexpr = prog().__nexpr;
    const addIds = selectWhere(nexpr, byKind("num/add"));
    const addId = [...addIds][0];

    const wrapped = wrapByName(nexpr, addId, "debug/span");
    const unwrapped = spliceWhere(commit(wrapped), byKind("debug/span"));
    expect(await fold(unwrapped, defaults(app))).toBe(60);
  });
});
