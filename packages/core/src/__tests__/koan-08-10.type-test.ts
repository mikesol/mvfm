/**
 * Compile-time koan 08/09/10 checks.
 */

import type { AdjOf, CollectReachable, DirtyAdjOf, DirtyIdOf, LiveAdj } from "../koan";
import { koan } from "../koan";
import type { NodeEntry } from "../koan/expr";

const prog = koan.app(koan.mul(koan.add(3, 4), 5));

const replaced = koan.commit(koan.replaceWhere(prog, koan.byKind("num/add"), "num/sub"));
type ReplacedAdj = AdjOf<typeof replaced>;
const _replacedKind: ReplacedAdj["c"]["kind"] = "num/sub";
// @ts-expect-error replaced entry is no longer num/add
const _replacedKindBad: ReplacedAdj["c"]["kind"] = "num/add";

type TestAdj = {
  a: NodeEntry<"lit", [], number>;
  b: NodeEntry<"add", ["a"], number>;
  c: NodeEntry<"mul", ["b"], number>;
  x: NodeEntry<"orphan", [], number>;
};
type Reach = CollectReachable<TestAdj, ["c"]>;
const _reachA: Reach = "a";
const _reachB: Reach = "b";
const _reachC: Reach = "c";
// @ts-expect-error orphan x is unreachable from c
const _reachX: Reach = "x";

type Live = LiveAdj<TestAdj, "c">;
const _liveC: Live["c"]["kind"] = "mul";
// @ts-expect-error x is filtered out from LiveAdj
type _liveX = Live["x"];

const d0 = koan.dirty(prog);
type D0Id = DirtyIdOf<typeof d0>;
const _d0Id: D0Id = "e";
// @ts-expect-error DirtyExpr is incompatible with NExpr
const _dirtyNotNExpr: typeof prog = d0;

const d1 = koan.removeEntry(d0, "a");
type D1Adj = DirtyAdjOf<typeof d1>;
// @ts-expect-error entry a was removed
type _d1A = D1Adj["a"];

const d2 = koan.rewireChildren(d0, "a", "b");
type D2Adj = DirtyAdjOf<typeof d2>;
const _d2CChildren: D2Adj["c"]["children"] = ["b", "b"];
