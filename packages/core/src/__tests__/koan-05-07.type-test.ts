/**
 * Compile-time koan 05/06/07 checks.
 */

import type { AdjOf, OutOf } from "../koan";
import { koan } from "../koan";

const prog = koan.app(koan.mul(koan.add(3, 4), 5));

const adds = koan.selectWhere(prog, koan.byKind("num/add"));
type AddKey = typeof adds extends Set<infer K> ? K : never;
const _addKey: AddKey = "c";
// @ts-expect-error add selection should not include literal "a"
const _addKeyBad: AddKey = "a";

const mapped = koan.mapWhere(prog, koan.byKind("num/add"), (entry) => ({
  kind: "num/sub" as const,
  children: entry.children,
  out: entry.out,
}));
type MappedAdj = AdjOf<typeof mapped>;
const _mappedKind: MappedAdj["c"]["kind"] = "num/sub";
// @ts-expect-error mapped add node should no longer be num/add
const _mappedKindBad: MappedAdj["c"]["kind"] = "num/add";
const _mappedOut: OutOf<typeof mapped> = 1;

const rootMapped = koan.mapWhere(prog, koan.byKind("num/mul"), () => ({
  kind: "str/repr" as const,
  children: ["c", "d"] as string[],
  out: "" as string,
}));
const _rootMappedOut: OutOf<typeof rootMapped> = "ok";
// @ts-expect-error root remap should change output type to string
const _rootMappedOutBad: OutOf<typeof rootMapped> = 2;
