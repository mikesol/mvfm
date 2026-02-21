/**
 * Koan 11: Wrap — insert wrapper node by target ID
 *
 * RULE: Never rewrite this file. Later koans import from here.
 *
 * What we prove:
 * - RewireList<T, Old, New> substitutes in a children tuple
 * - RewireParents<Adj, TargetID, WrapperID> rewires all parents
 * - WrapOneResult<Adj, TargetID, WrapperKind, WrapperID> computes full result adj
 * - wrapByName(expr, targetId, wrapperKind) inserts wrapper using next counter ID
 * - Wrapper's children = [targetId], kind = wrapperKind
 * - All parents of target now point to wrapper instead
 * - If target is root, new root is wrapper
 * - Counter advances via Increment
 * - CRITICAL: wrapper itself must NOT have its child rewired to itself
 *
 * Type-level:
 * - Wrapper entry visible in adj at counter position
 * - Parent children tuple updated (["c","d"] → ["f","d"])
 * - Root ID changes when wrapping root
 *
 * Imports: 10-commit (re-exports chain)
 *
 * Gate:
 *   npx tsc --noEmit --strict spike-koans/11-wrap.ts
 *   npx tsx spike-koans/11-wrap.ts
 */

export * from "./11-commit";

import type {
  NodeEntry,
  NExpr,
  AdjOf,
  IdOf,
  CtrOf,
  RuntimeEntry,
  Increment,
  RewireAdj,
} from "./11-commit";
import { makeNExpr, incrementId, numLit, add, mul, app } from "./11-commit";

// ─── TargetOut: extract output type of target node ───────────────────
type TargetOut<Adj, ID extends string> = ID extends keyof Adj
  ? Adj[ID] extends NodeEntry<any, any, infer O>
    ? O
    : unknown
  : unknown;

// ─── RewireParents: rewire original adj (wrapper added separately) ───
export type RewireParents<
  Adj,
  TargetID extends string,
  WrapperID extends string,
> = RewireAdj<Adj, TargetID, WrapperID>;

// ─── WrapOneResult: full adj after wrapping ──────────────────────────
// 1. Rewire all existing entries: targetId → wrapperId in children
// 2. Add wrapper entry with children = [targetId]
// Wrapper is added AFTER rewiring, so its child is NOT self-rewired.
export type WrapOneResult<
  Adj,
  TargetID extends string,
  WrapperKind extends string,
  WrapperID extends string,
> = RewireParents<Adj, TargetID, WrapperID> &
  Record<
    WrapperID,
    NodeEntry<WrapperKind, [TargetID], TargetOut<Adj, TargetID>>
  >;

// ─── WrapRoot: if target is root, wrapper becomes new root ───────────
type WrapRoot<
  R extends string,
  TargetID extends string,
  WrapperID extends string,
> = R extends TargetID ? WrapperID : R;

// ─── wrapByName: insert wrapper above target ─────────────────────────
export function wrapByName<
  O,
  R extends string,
  Adj,
  C extends string,
  TargetID extends string,
  WrapperKind extends string,
>(
  expr: NExpr<O, R, Adj, C>,
  targetId: TargetID,
  wrapperKind: WrapperKind,
): NExpr<
  O,
  WrapRoot<R, TargetID, C>,
  WrapOneResult<Adj, TargetID, WrapperKind, C>,
  Increment<C>
> {
  const wrapperId = expr.__counter;
  const nextCounter = incrementId(wrapperId);
  const targetEntry = expr.__adj[targetId];

  // Rewire existing entries (wrapper not yet added — safe)
  const newAdj: Record<string, RuntimeEntry> = {};
  for (const [id, entry] of Object.entries(expr.__adj)) {
    newAdj[id] = {
      ...entry,
      children: entry.children.map((c) =>
        c === targetId ? wrapperId : c,
      ),
    };
  }

  // Add wrapper AFTER rewiring — its child stays as targetId
  newAdj[wrapperId] = {
    kind: wrapperKind,
    children: [targetId],
    out: targetEntry.out,
  };

  const newRoot = expr.__id === targetId ? wrapperId : expr.__id;
  return makeNExpr(newRoot, newAdj, nextCounter) as any;
}

// ═══════════════════════════════════════════════════════════════════════
// COMPILE-TIME TESTS
// ═══════════════════════════════════════════════════════════════════════

// (3+4)*5: a=lit3, b=lit4, c=add, d=lit5, e=mul, counter=f
const prog = app(mul(add(numLit(3), numLit(4)), numLit(5)));

// --- Wrap "c" (add node): e(mul) → f(span) → c(add) ---
const wrapped = wrapByName(prog, "c", "telemetry/span");
type WAdj = AdjOf<typeof wrapped>;

// Wrapper "f" exists with correct kind and children
const _wfKind: WAdj["f"]["kind"] = "telemetry/span";
const _wfChildren: WAdj["f"]["children"] = ["c"];

// Parent "e" rewired: ["c","d"] → ["f","d"]
const _weChildren: WAdj["e"]["children"] = ["f", "d"];
// @ts-expect-error — "e" no longer points to "c"
const _weChildrenBad: WAdj["e"]["children"] = ["c", "d"];

// Target "c" unchanged
const _wcKind: WAdj["c"]["kind"] = "num/add";
const _wcChildren: WAdj["c"]["children"] = ["a", "b"];

// Root unchanged (target wasn't root)
type WId = IdOf<typeof wrapped>;
const _wId: WId = "e";

// Counter advanced
type WCtr = CtrOf<typeof wrapped>;
const _wCtr: WCtr = "g";

// --- Wrap root "e": new root is "f" ---
const wrappedRoot = wrapByName(prog, "e", "debug/root");
type WRAdj = AdjOf<typeof wrappedRoot>;

type WRId = IdOf<typeof wrappedRoot>;
const _wrId: WRId = "f";
// @ts-expect-error — root is now "f", not "e"
const _wrIdBad: WRId = "e";

const _wrfChildren: WRAdj["f"]["children"] = ["e"];
const _wrfKind: WRAdj["f"]["kind"] = "debug/root";

// --- CRITICAL: wrapper child NOT self-rewired ---
// If wrapper "f" wraps "c", f.children must be ["c"], not ["f"]
const _noSelfRewire: WAdj["f"]["children"] = ["c"];
// @ts-expect-error — would be self-referential if rewiring hit the wrapper
const _selfRewireBad: WAdj["f"]["children"] = ["f"];

// ═══════════════════════════════════════════════════════════════════════
// RUNTIME TESTS
// ═══════════════════════════════════════════════════════════════════════

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${msg}`);
  }
}

// Wrap "c"
assert(wrapped.__adj["f"].kind === "telemetry/span", "wrapper kind");
assert(
  JSON.stringify(wrapped.__adj["f"].children) === '["c"]',
  "wrapper children = [c]",
);
assert(
  JSON.stringify(wrapped.__adj["e"].children) === '["f","d"]',
  "parent rewired to wrapper",
);
assert(wrapped.__adj["c"].kind === "num/add", "target unchanged");
assert(wrapped.__id === "e", "root unchanged when wrapping non-root");
assert(wrapped.__counter === "g", "counter advanced");

// Wrap root "e"
assert(wrappedRoot.__id === "f", "root becomes wrapper");
assert(
  JSON.stringify(wrappedRoot.__adj["f"].children) === '["e"]',
  "root wrapper children",
);
assert(wrappedRoot.__adj["f"].kind === "debug/root", "root wrapper kind");

// No self-rewiring
assert(
  wrappedRoot.__adj["f"].children[0] === "e",
  "wrapper child is target, not self",
);

console.log(`\n11-wrap: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
