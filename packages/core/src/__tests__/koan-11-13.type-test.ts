/**
 * Compile-time koan 11/12/13 checks.
 */

import type { AdjOf, IdOf } from "../koan";
import { koan } from "../koan";

const prog = koan.app(koan.mul(koan.add(3, 4), 5));

const cleaned = koan.commit(
  koan.gc(
    koan.addEntry(koan.dirty(prog), "orphan", { kind: "dead", children: [], out: undefined }),
  ),
);
type CleanAdj = AdjOf<typeof cleaned>;
// @ts-expect-error orphan is removed by gc before commit
type _cleanOrphan = CleanAdj["orphan"];

const wrapped = koan.commit(koan.wrapByName(prog, "c", "debug/wrap"));
type WrappedAdj = AdjOf<typeof wrapped>;
const _wrappedKind: WrappedAdj["f"]["kind"] = "debug/wrap";
const _wrappedChildren: WrappedAdj["e"]["children"] = ["f", "d"];
// @ts-expect-error e should no longer point directly to c after wrapping
const _wrappedChildrenBad: WrappedAdj["e"]["children"] = ["c", "d"];

const spliced = koan.spliceWhere(wrapped, koan.byKind("debug/wrap"));
type SplicedAdj = AdjOf<typeof spliced>;
const _splicedChildren: SplicedAdj["e"]["children"] = ["c", "d"];
// @ts-expect-error wrapper node is removed by spliceWhere
type _splicedF = SplicedAdj["f"];

type SplicedRoot = IdOf<typeof spliced>;
const _splicedRoot: SplicedRoot = "e";
