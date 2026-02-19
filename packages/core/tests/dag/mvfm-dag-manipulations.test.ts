/**
 * Integration tests: mvfm() build → DAG manipulation → fold → assert.
 *
 * Each test builds a program via mvfm(), manipulates the resulting
 * NExpr using koan primitives (select, map, replace, splice, wrap,
 * gc, pipe), then folds the manipulated DAG and asserts on the result.
 *
 * Type assertions use @ts-expect-error to prove the type system
 * tracks manipulations correctly.
 */

import { describe, it, expect } from "vitest";
import { mvfm } from "../../src/dag/builder";
import { fold, defaults } from "../../src/dag/fold";
import type { AdjOf, IdOf, OutOf } from "../../src/dag/00-expr";
import { selectWhere } from "../../src/dag/05-select";
import { mapWhere } from "../../src/dag/06-map";
import { replaceWhere } from "../../src/dag/07-replace";
import { pipe } from "../../src/dag/14-pipe";
import { spliceWhere } from "../../src/dag/12-splice";
import { wrapByName } from "../../src/dag/11-wrap";
import {
  byKind,
  byKindGlob,
  isLeaf,
  not,
  and,
  hasChildCount,
} from "../../src/dag/04-predicates";
import { numDagPlugin } from "../../src/plugins/num/index";
import { strDagPlugin } from "../../src/plugins/str/index";
import { booleanDagPlugin } from "../../src/plugins/boolean/index";

const plugins = [numDagPlugin, strDagPlugin, booleanDagPlugin];

describe("DAG manipulation: selectWhere", () => {
  it("selects leaf nodes from a built program", () => {
    const prog = mvfm(numDagPlugin, ($) =>
      $.num.mul($.num.add($.num.literal(3), $.num.literal(4)), $.num.literal(5)),
    );
    const leaves = selectWhere(prog.expr, isLeaf());
    // Leaves are the three literals
    expect(leaves.size).toBe(3);
  });
  it("selects by kind", () => {
    const prog = mvfm(numDagPlugin, ($) =>
      $.num.add($.num.literal(1), $.num.literal(2)),
    );
    const adds = selectWhere(prog.expr, byKind("num/add"));
    expect(adds.size).toBe(1);
  });
  it("compound predicate: non-leaf num nodes", () => {
    const prog = mvfm(numDagPlugin, ($) =>
      $.num.mul($.num.add($.num.literal(3), $.num.literal(4)), $.num.literal(5)),
    );
    const branches = selectWhere(prog.expr, and(byKindGlob("num/"), not(isLeaf())));
    expect(branches.size).toBe(2); // add and mul
  });
});

describe("DAG manipulation: replaceWhere + fold", () => {
  it("replace add→sub changes evaluation result", async () => {
    const prog = mvfm(numDagPlugin, ($) =>
      $.num.add($.num.literal(10), $.num.literal(3)),
    );
    // Before: 10 + 3 = 13
    expect(await prog.eval()).toBe(13);

    // Replace add with sub: 10 - 3 = 7
    const replaced = replaceWhere(prog.expr, byKind("num/add"), "num/sub");
    const interp = defaults(prog.plugins);
    const result = await fold(replaced, interp);
    expect(result).toBe(7);

    // Type assertion: replaced adj has num/sub where add was
    type RAdj = AdjOf<typeof replaced>;
    // The root node's kind should be num/sub in the type system
    // (We can't easily test the specific key since IDs are content-addressed,
    // but we can verify output type is preserved)
    type ROut = OutOf<typeof replaced>;
    const _checkOut: ROut = 42; // still number
    // @ts-expect-error — output is number, not string
    const _badOut: ROut = "nope";
  });
  it("replace mul→div changes nested evaluation", async () => {
    const prog = mvfm(numDagPlugin, ($) =>
      $.num.mul($.num.literal(20), $.num.literal(4)),
    );
    expect(await prog.eval()).toBe(80);

    const replaced = replaceWhere(prog.expr, byKind("num/mul"), "num/div");
    const result = await fold(replaced, defaults(prog.plugins));
    expect(result).toBe(5); // 20 / 4
  });
});

describe("DAG manipulation: mapWhere + fold", () => {
  it("map literals to double their value", async () => {
    const prog = mvfm(numDagPlugin, ($) =>
      $.num.add($.num.literal(3), $.num.literal(4)),
    );
    expect(await prog.eval()).toBe(7);

    // Map all core/literal nodes, doubling their out value
    const doubled = mapWhere(prog.expr, byKind("core/literal"), (entry) => ({
      kind: "core/literal" as const,
      children: entry.children,
      out: (entry.out as number) * 2,
    }));
    const result = await fold(doubled, defaults(prog.plugins));
    expect(result).toBe(14); // 6 + 8
  });
  it("map preserves unmatched nodes", async () => {
    const prog = mvfm(numDagPlugin, ($) =>
      $.num.mul($.num.add($.num.literal(2), $.num.literal(3)), $.num.literal(5)),
    );
    // Only map add→sub, mul stays
    const mapped = mapWhere(prog.expr, byKind("num/add"), (entry) => ({
      kind: "num/sub" as const,
      children: entry.children,
      out: entry.out,
    }));
    const result = await fold(mapped, defaults(prog.plugins));
    expect(result).toBe(-5); // (2-3)*5 = -5
  });
});

describe("DAG manipulation: wrapByName + spliceWhere round-trip", () => {
  it("wrap then splice restores original behavior", async () => {
    const prog = mvfm(numDagPlugin, ($) =>
      $.num.add($.num.literal(10), $.num.literal(20)),
    );
    const original = await prog.eval();
    expect(original).toBe(30);

    // Find the root ID to wrap a child
    const rootId = prog.expr.__id;
    const rootEntry = prog.expr.__adj[rootId];
    const firstChildId = rootEntry.children[0];

    // Wrap then immediately splice the wrapper out
    const wrapped = wrapByName(prog.expr, firstChildId, "debug/wrap");
    const unwrapped = spliceWhere(wrapped, byKind("debug/wrap"));

    // Need a handler for debug/wrap in case splice doesn't fully remove
    const interp = defaults(prog.plugins);
    const result = await fold(unwrapped, interp);
    expect(result).toBe(30); // same as original
  });
});

describe("DAG manipulation: spliceWhere + fold", () => {
  it("splice root promotes first child", async () => {
    const prog = mvfm(numDagPlugin, ($) =>
      $.num.neg($.num.literal(42)),
    );
    expect(await prog.eval()).toBe(-42);

    // Splice out neg (root) → literal becomes new root
    const spliced = spliceWhere(prog.expr, byKind("num/neg"));
    const result = await fold(spliced, defaults(prog.plugins));
    expect(result).toBe(42); // literal value, neg removed

    // Type: root ID changed
    type SId = IdOf<typeof spliced>;
    // Root should no longer be the neg node
    // (We verify at runtime that the literal is now root)
    expect(spliced.__id).not.toBe(prog.expr.__id);
  });
});

describe("DAG manipulation: pipe (DagQL chaining)", () => {
  it("replace then splice via pipe", async () => {
    const prog = mvfm(numDagPlugin, ($) =>
      $.num.mul($.num.add($.num.literal(3), $.num.literal(4)), $.num.literal(5)),
    );
    expect(await prog.eval()).toBe(35); // (3+4)*5

    // pipe: replace add→sub, then splice leaves
    const result = pipe(
      prog.expr,
      (e) => replaceWhere(e, byKind("num/add"), "num/sub"),
      (e) => spliceWhere(e, isLeaf()),
    );

    // After splicing leaves, the sub and mul nodes have no children
    // to evaluate, so fold would fail. Instead, verify the structure.
    expect(Object.keys(result.__adj).length).toBe(2); // sub + mul survive
    expect(result.__adj[result.__id].kind).toBe("num/mul");

    // Type precision: spliced keys are gone from adj type
    type PAdj = AdjOf<typeof result>;
    type PId = IdOf<typeof result>;
    // Output type preserved through pipe
    type POut = OutOf<typeof result>;
    const _out: POut = 42;
    // @ts-expect-error — still number
    const _outBad: POut = "string";
  });
  it("single-step pipe works", async () => {
    const prog = mvfm(numDagPlugin, ($) =>
      $.num.add($.num.literal(5), $.num.literal(3)),
    );
    const replaced = pipe(
      prog.expr,
      (e) => replaceWhere(e, byKind("num/add"), "num/sub"),
    );
    const result = await fold(replaced, defaults(prog.plugins));
    expect(result).toBe(2); // 5 - 3
  });
  it("three-step pipe with type flow", async () => {
    const prog = mvfm(numDagPlugin, ($) =>
      $.num.mul($.num.add($.num.literal(10), $.num.literal(5)), $.num.literal(2)),
    );
    expect(await prog.eval()).toBe(30); // (10+5)*2

    // Step 1: replace add→sub
    // Step 2: map literals, triple their values
    // Step 3: replace mul→div
    const transformed = pipe(
      prog.expr,
      (e) => replaceWhere(e, byKind("num/add"), "num/sub"),
      (e) => mapWhere(e, byKind("core/literal"), (entry) => ({
        kind: "core/literal" as const,
        children: entry.children,
        out: (entry.out as number) * 3,
      })),
      (e) => replaceWhere(e, byKind("num/mul"), "num/div"),
    );

    const result = await fold(transformed, defaults(prog.plugins));
    // (30-15)/6 = 2.5
    expect(result).toBe(2.5);
  });
});

describe("DAG manipulation: cross-plugin", () => {
  it("select by kind glob across plugins", () => {
    const prog = mvfm(plugins, ($) =>
      $.cond(
        $.boolean.tt(),
        $.num.add($.num.literal(1), $.num.literal(2)),
        $.str.upper($.str.literal("no")),
      ),
    );
    const numNodes = selectWhere(prog.expr, byKindGlob("num/"));
    const strNodes = selectWhere(prog.expr, byKindGlob("str/"));
    const boolNodes = selectWhere(prog.expr, byKindGlob("boolean/"));

    expect(numNodes.size).toBeGreaterThan(0);
    expect(strNodes.size).toBeGreaterThan(0);
    expect(boolNodes.size).toBeGreaterThan(0);
  });
  it("hasChildCount selects binary operations", () => {
    const prog = mvfm(numDagPlugin, ($) =>
      $.num.add($.num.neg($.num.literal(1)), $.num.literal(2)),
    );
    const binary = selectWhere(prog.expr, hasChildCount(2));
    const unary = selectWhere(prog.expr, hasChildCount(1));
    expect(binary.size).toBe(1); // add
    expect(unary.size).toBe(1); // neg
  });
});
