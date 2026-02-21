/**
 * Compile-time koan 14/15/16 checks.
 */

import type { AdjOf, IdOf, OutOf } from "../koan";
import { koan } from "../koan";

const prog = koan.app(koan.mul(koan.add(3, 4), 5));
const named = koan.name(prog, "the-sum", "c");
type NamedAdj = AdjOf<typeof named>;
const _aliasKind: NamedAdj["@the-sum"]["kind"] = "@alias";

const replaced = koan.commit(koan.replaceWhere(named, koan.byName("the-sum"), "num/sub"));
type ReplacedAdj = AdjOf<typeof replaced>;
const _replacedKind: ReplacedAdj["c"]["kind"] = "num/sub";
// @ts-expect-error named replacement changes c from num/add to num/sub
const _replacedKindBad: ReplacedAdj["c"]["kind"] = "num/add";

const piped = koan.pipe(
  prog,
  (e) => koan.replaceWhere(e, koan.byKind("num/add"), "num/sub"),
  (e) => koan.spliceWhere(koan.commit(e), koan.isLeaf()),
);
type PipedAdj = AdjOf<typeof piped>;
const _pipedChildren: PipedAdj["e"]["children"] = ["c"];
type PipedRoot = IdOf<typeof piped>;
const _pipedRoot: PipedRoot = "e";

const interp = koan.defaults(koan.stdPlugins);
const foldResult = koan.fold(prog, interp);
const _foldResult: Promise<OutOf<typeof prog>> = foldResult;
// @ts-expect-error fold(prog, interp) resolves to number, not string
const _foldResultBad: Promise<string> = foldResult;
