# Type Safety for All DAG Mutation Operations

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add type-level safety guards to all DAG mutations (mapWhere, spliceWhere, rewireChildren, swapEntry) and route NExpr→NExpr operations through DirtyExpr→commit.

**Architecture:** Each unsafe operation gets a type-level check that returns a branded error type on mismatch (not assignable to NExpr or DirtyExpr). NExpr→NExpr convenience functions (replaceWhere, mapWhere, wrapByName) change to return DirtyExpr, requiring explicit commit().

**Working directory:** `/home/mikesol/Documents/GitHub/ilo/ilo/.worktrees/issue-293-codex-0/packages/core/`

---

## Context

Currently, all DAG mutation operations accept and return NExpr/DirtyExpr without checking that output types are preserved. This means:

- **mapWhere** — callback can change `out` type, breaking parent expectations (e.g., map `num/eq` (boolean output) to `num/add` (number output) in an `ite` cond slot)
- **spliceWhere** — splicing a type-changing node (e.g., `num/eq` outputs boolean, but its child outputs number) silently breaks the parent's type expectations
- **rewireChildren** — can wire parent to child with incompatible `out` type
- **swapEntry** — can replace entry with different `out` type

Additionally, `replaceWhere`, `mapWhere`, and `wrapByName` return NExpr directly, bypassing the dirty→commit validation gate. These should return DirtyExpr.

## Type Safety Strategy

For each unsafe operation, check that the **output type is preserved** — the new/modified entry's `out` must extend the original entry's `out`. Returns a branded error type (not assignable to NExpr/DirtyExpr) on mismatch.

---

### Task 1: Write type-safety tests for mapWhere

**Files:**
- Create: `tests/map-type-safety.test.ts`

Write tests using a custom `itePlugin` (ctrl/ite: boolean, number, number → number). Import from `../src/koan` using the `koan` namespace for runtime functions, and import types (NExpr, CExpr, KindSpec, Plugin, NodeEntry) from `../src/koan` as named type exports.

**itePlugin definition** (use in all type-safety test files):
```typescript
import type { CExpr, KindSpec, NExpr, Plugin } from "../../src/koan";
import { koan } from "../../src/koan";

const itePlugin = {
  name: "ite",
  ctors: {
    ite: <C, T, E>(
      cond: C, then_: T, else_: E,
    ): CExpr<number, "ctrl/ite", [C, T, E]> => koan.makeCExpr("ctrl/ite", [cond, then_, else_]),
  },
  kinds: {
    "ctrl/ite": {
      inputs: [false, 0, 0],
      output: 0,
    } as KindSpec<[boolean, number, number], number>,
  },
  traits: {},
  lifts: {},
  nodeKinds: ["ctrl/ite"] as const,
} satisfies Plugin;

const appC = koan.createApp(koan.numPluginU, koan.strPluginU, koan.boolPluginU, koan.ordPlugin, itePlugin);
```

**Runtime corruption tests:**
1. `mapWhere` changes eq's `out` from boolean to number → ite gets number in boolean slot → wrong result
2. `mapWhere` changes a number node to boolean output → parent expects number, gets boolean

**Type-level tests (will initially be `as any` since guards don't exist yet):**
1. mapWhere that preserves `out` → should compile after guards added
2. mapWhere that changes `out` → should be `@ts-expect-error` after guards added

Use `createTestInterp()` from `../kitchen-sink-helpers` for the interpreter. Add an `ite` handler:
```typescript
interp["ctrl/ite"] = async function* () {
  const cond = yield 0;
  if (cond) return yield 1;
  return yield 2;
} as Handler;
```

Keep file under 120 lines.

---

### Task 2: Write type-safety tests for spliceWhere

**Files:**
- Create: `tests/splice-type-safety.test.ts`

**Runtime corruption tests:**
1. `spliceWhere(byKind("num/eq"))` inside ite: splicing eq picks child[0] (number) to replace boolean slot → ite gets truthy number instead of false
2. Same with different literal values to show the corruption pattern
3. One test where splice is "insidiously correct" (eq(0,...) → 0 is falsy, same result by accident)
4. One test where splice flips the result

**Type-level tests (initially `as any`):**
1. Splice that changes output type (eq: boolean→number child) → should be `@ts-expect-error`
2. Splice that preserves output type (add: number→number child) → should compile

Keep file under 170 lines.

---

### Task 3: Write type-safety tests for rewireChildren and swapEntry

**Files:**
- Create: `tests/dirty-type-safety.test.ts`

**Runtime corruption tests:**
1. `rewireChildren` from boolean child → number child in ite's cond slot → wrong result
2. `swapEntry` replaces boolean entry with number entry → parent gets wrong type

**Type-level tests using explicit Adj types** (for precise type checking without relying on inference):
```typescript
type TestAdj = {
  n1: NodeEntry<"num/lit", [], number>;
  n2: NodeEntry<"bool/lit", [], boolean>;
  n3: NodeEntry<"ctrl/ite", ["n2", "n1", "n1"], number>;
};
```

Create a `makeFakeDirty()` helper returning `DirtyExpr<number, "n3", TestAdj, "n4">` with matching runtime data.

1. rewireChildren where new ref has same `out` → should compile
2. rewireChildren where new ref has different `out` → should be `@ts-expect-error`
3. swapEntry preserving `out` → should compile
4. swapEntry changing `out` → should be `@ts-expect-error`

Keep file under 170 lines.

---

### Task 4: Add SpliceTypeSafe guard to spliceWhere

**Files:**
- Modify: `src/koan/splice.ts`

Add `SpliceTypeSafe` type check: for each matched node, verify that `child[0]`'s output extends the matched node's output:

```typescript
/** Index into a tuple. */
type TupleAt<T extends string[], I extends number, Acc extends unknown[] = []> = T extends [
  infer H extends string,
  ...infer Rest extends string[],
]
  ? Acc["length"] extends I ? H : TupleAt<Rest, I, [...Acc, unknown]>
  : never;

/**
 * For each matched node, check child[I]'s Out extends matched node's Out.
 * True if all compatible, false if any mismatch.
 */
type SpliceTypeSafe<Adj, Matched extends string, I extends number> = keyof {
  [K in Matched & keyof Adj as Adj[K] extends {
    children: infer HC extends string[];
    out: infer MO;
  }
    ? TupleAt<HC, I> extends infer R extends string
      ? R extends keyof Adj
        ? Adj[R] extends { out: infer CO }
          ? CO extends MO ? never : K
          : K
        : K
      : K
    : K]: true;
} extends never ? true : false;

/** Branded error type for type-unsafe splices. */
export interface SpliceTypeError<_Msg extends string = string> {
  readonly __brand: unique symbol;
  readonly __spliceTypeError: _Msg;
}
```

Update `spliceWhere` signature to accept an optional `childIndex` parameter and add the type guard:
```typescript
export function spliceWhere<
  O, R extends string, Adj, C extends string, P extends PredBase,
  I extends number = 0,
>(
  expr: NExpr<O, R, Adj, C>,
  pred: P,
  childIndex?: I,
): SpliceTypeSafe<Adj, SelectKeys<Adj, P>, I> extends true
  ? NExpr<O, SpliceRoot<R, Adj, SelectKeys<Adj, P>>, SpliceAdj<Adj, SelectKeys<Adj, P>>, C>
  : SpliceTypeError<"replacement child output type does not match spliced node output type">
```

The runtime implementation stays the same (splice always picks child[0] by default). The `SpliceAdj` type already handles children correctly.

Export `SpliceTypeError` from `src/koan/index.ts`.

---

### Task 5: Add MapTypeSafe guard to mapWhere

**Files:**
- Modify: `src/koan/map.ts`

Add type-level check: for each matched entry, verify `NewEntry["out"] extends MatchedEntry["out"]`:

```typescript
/**
 * Check that NewEntry's output type extends all matched entries' output types.
 * Returns true if safe, false if any matched entry has incompatible output.
 */
type MapTypeSafe<Adj, P, NewEntry extends NodeEntry<string, string[], any>> =
  NewEntry extends NodeEntry<any, any, infer NO>
    ? MatchingEntries<Adj, P> extends NodeEntry<any, any, infer MO>
      ? NO extends MO ? true : false
      : true  // no matches = safe
    : false;

/** Branded error type for type-unsafe maps. */
export interface MapTypeError<_Msg extends string = string> {
  readonly __brand: unique symbol;
  readonly __mapTypeError: _Msg;
}
```

Update `mapWhere` to:
1. Accept both `NExpr` and `DirtyExpr` as input (for chaining)
2. Return `DirtyExpr` (not NExpr) — requiring `commit()` before fold
3. Return `MapTypeError` when types don't match

```typescript
import type { DirtyExpr } from "./dirty";

export function mapWhere<
  O, R extends string, Adj, C extends string,
  P extends PredBase,
  NewEntry extends NodeEntry<string, string[], any>,
>(
  expr: NExpr<O, R, Adj, C> | DirtyExpr<O, R, Adj, C>,
  pred: P,
  fn: (entry: MatchingEntries<Adj, P>) => NewEntry,
): MapTypeSafe<Adj, P, NewEntry> extends true
  ? DirtyExpr<MapOut<O, Adj, R, P, NewEntry>, R, MapAdj<Adj, P, NewEntry>, C>
  : MapTypeError<"callback output type does not match matched node output type">
```

Export `MapTypeError` from `src/koan/index.ts`.

---

### Task 6: Add RewireTypeSafe and SwapTypeSafe guards to dirty operations

**Files:**
- Modify: `src/koan/dirty.ts`

**RewireTypeSafe:** Check `Adj[New]["out"] extends Adj[Old]["out"]`:
```typescript
type RewireTypeSafe<Adj, Old extends string, New extends string> =
  Old extends keyof Adj
    ? New extends keyof Adj
      ? Adj[New] extends { out: infer NO }
        ? Adj[Old] extends { out: infer OO }
          ? NO extends OO ? true : false
          : true
        : false
      : false  // newRef not in adj
    : true;  // oldRef not in adj = no-op

export interface RewireTypeError<_Msg extends string = string> {
  readonly __brand: unique symbol;
  readonly __rewireTypeError: _Msg;
}
```

Update `rewireChildren` return type:
```typescript
): RewireTypeSafe<Adj, Old, New> extends true
  ? DirtyExpr<O, R, RewireAdj<Adj, Old, New>, C>
  : RewireTypeError<"new ref output type does not match old ref output type">
```

**SwapTypeSafe:** Check `NewEntry["out"] extends Adj[Id]["out"]`:
```typescript
type SwapTypeSafe<Adj, Id extends string, E extends NodeEntry<string, string[], any>> =
  Id extends keyof Adj
    ? E extends NodeEntry<any, any, infer NO>
      ? Adj[Id] extends { out: infer OO }
        ? NO extends OO ? true : false
        : true
      : false
    : true;  // new entry, no constraint

export interface SwapTypeError<_Msg extends string = string> {
  readonly __brand: unique symbol;
  readonly __swapTypeError: _Msg;
}
```

Update `swapEntry` return type:
```typescript
): SwapTypeSafe<Adj, Id, E> extends true
  ? DirtyExpr<O, R, SwapAdj<Adj, Id, E>, C>
  : SwapTypeError<"new entry output type does not match existing entry output type">
```

Export `RewireTypeError`, `SwapTypeError` from `src/koan/index.ts`.

---

### Task 7: Update type-safety tests to use guards (remove `as any`)

**Files:**
- Modify: `tests/map-type-safety.test.ts`
- Modify: `tests/splice-type-safety.test.ts`
- Modify: `tests/dirty-type-safety.test.ts`

Update type-level tests:
- Invalid operations: add `@ts-expect-error` annotations (result is error type, not assignable to NExpr/DirtyExpr)
- Valid operations: verify they compile without error
- Pattern: `const _check: NExpr<any, any, any, any> = result;` with `@ts-expect-error` for invalid

For mapWhere tests: valid results now need `koan.commit(mapped)` before assigning to `NExpr<...>`.

Run `npx tsc --noEmit` to verify all type errors are caught. All `@ts-expect-error` annotations must be consumed (not unused).

---

### Task 8: Route replaceWhere and wrapByName through DirtyExpr

**Files:**
- Modify: `src/koan/replace.ts` — return type changes to DirtyExpr
- Modify: `src/koan/wrap.ts` — return type changes to DirtyExpr

**replaceWhere:** Since `ReplaceKind` preserves `out`, it should always be type-safe (no error type needed). Change return to DirtyExpr and accept both NExpr and DirtyExpr as input:

```typescript
import type { DirtyExpr } from "./dirty";

export function replaceWhere<...>(
  expr: NExpr<O, R, Adj, C> | DirtyExpr<O, R, Adj, C>,
  pred: P,
  newKind: NewKind,
): DirtyExpr<
  MapOut<O, Adj, R, P, ReplaceKind<MatchingEntries<Adj, P>, NewKind>>,
  R,
  MapAdj<Adj, P, ReplaceKind<MatchingEntries<Adj, P>, NewKind>>,
  C
>
```

**wrapByName:** Change return to DirtyExpr and accept both NExpr and DirtyExpr:

```typescript
import type { DirtyExpr } from "./dirty";

export function wrapByName<...>(
  expr: NExpr<O, R, Adj, C> | DirtyExpr<O, R, Adj, C>,
  targetId: TargetID,
  wrapperKind: WrapperKind,
): DirtyExpr<O, WrapRoot<R, TargetID, C>, WrapOneResult<Adj, TargetID, WrapperKind, C>, Increment<C>>
```

---

### Task 9: Update all test callers to use commit()

Since `mapWhere`, `replaceWhere`, and `wrapByName` now return DirtyExpr, every caller that feeds their result into `fold` or assigns to `NExpr` must wrap with `koan.commit(...)`.

**Files to update (every file that calls replaceWhere/mapWhere/wrapByName without commit):**
- `tests/koans/07-map.test.ts`
- `tests/koans/08-replace.test.ts`
- `tests/koans/12-wrap.test.ts`
- `tests/koans/13-splice.test.ts` (if it uses replaceWhere)
- `tests/koans/14-named.test.ts`
- `tests/koans/15-dagql.test.ts`
- `tests/kitchen-sink.test.ts`
- `tests/kitchen-sink-extensions.test.ts`
- Any other test files that call these functions

**Pattern:**
```typescript
// Before:
const mapped = koan.mapWhere(prog, koan.byKind("num/add"), (e) => ({ ... }));
// After:
const mapped = koan.commit(koan.mapWhere(prog, koan.byKind("num/add"), (e) => ({ ... })));

// Before:
const replaced = koan.replaceWhere(prog, koan.byKind("num/mul"), "num/sub");
// After:
const replaced = koan.commit(koan.replaceWhere(prog, koan.byKind("num/mul"), "num/sub"));

// Before:
const wrapped = koan.wrapByName(prog, targetId, "wrapper/kind");
// After:
const wrapped = koan.commit(koan.wrapByName(prog, targetId, "wrapper/kind"));
```

For chained operations (pipe), the intermediate results can stay as DirtyExpr — only the final result before fold needs commit:
```typescript
const r = koan.commit(koan.replaceWhere(
  koan.replaceWhere(prog, koan.byKind("num/add"), "num/sub"),
  koan.byKind("num/mul"), "num/add"
));
```

---

### Task 10: Full validation

Run:
```bash
npx tsc --noEmit     # type-level checks
npm test             # all tests pass
npm run build        # build succeeds
npm run check        # lint passes
```

Verify:
- All `@ts-expect-error` annotations are consumed (not unused)
- All runtime tests pass
- No regressions in existing tests

---

## Key Files Reference

| File | Role |
|------|------|
| `src/koan/splice.ts` | spliceWhere — needs SpliceTypeSafe + SpliceTypeError |
| `src/koan/map.ts` | mapWhere + MapAdj/MapOut — needs MapTypeSafe + DirtyExpr return |
| `src/koan/replace.ts` | replaceWhere (wrapper over mapWhere) — needs DirtyExpr return |
| `src/koan/wrap.ts` | wrapByName — needs DirtyExpr return |
| `src/koan/dirty.ts` | rewireChildren, swapEntry — needs RewireTypeSafe, SwapTypeSafe |
| `src/koan/commit.ts` | commit() validation gate |
| `src/koan/expr.ts` | NExpr, NodeEntry, DirtyExpr type definitions |
| `src/koan/predicates.ts` | PredBase, EvalPred, SelectKeys |
| `src/koan/index.ts` | Export new error types here |
