# Issue #293: Core Rebuild Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the entire `packages/core/src/` implementation with a koan-driven rebuild, validated by 20 frozen koan gates and a comprehensive golden test suite written entirely upfront.

**Architecture:** Delete-and-rebuild. All tests (koans + golden suite + production extension tests) are written before any implementation begins. Implementation follows the koan chain (00→16) with each koan group unlocking the next batch of passing golden tests. Production extensions (ST volatile/taint, error propagation, fiber parallelism, scoped lambdas) are layered last.

**Tech Stack:** TypeScript 5.x, Vitest, `@ts-expect-error` for negative type tests, async generators for fold handlers.

---

## Phase A: Build the Test Fortress

### Task 1: Create worktree and infrastructure

**Files:**
- Create: `packages/core/src/__koans__/` directory
- Create: `packages/core/tests/golden/` directory
- Create: `packages/core/vitest.config.ts` (if needed)

**Step 1: Create worktree**

```bash
git worktree add .worktrees/issue-293-opus-0 -b issue-293-opus-0 spike-koans-baseline
```

**Step 2: Set up koan gate directory**

```bash
mkdir -p packages/core/src/__koans__
mkdir -p packages/core/tests/golden
```

**Step 3: Verify build infrastructure**

```bash
npm run build && npm run check && npm test
```
Expected: All pass on baseline.

**Step 4: Commit infrastructure**

```bash
git add -A && git commit -m "chore: set up koan gate and golden test infrastructure"
```

---

### Task 2: Copy frozen koans as gate tests

Copy all 20 koan files from `spike-koans/` into `packages/core/src/__koans__/`. These are frozen — never modified. Then create a thin test runner that executes each koan.

**Files:**
- Copy: `spike-koans/*.ts` → `packages/core/src/__koans__/`
- Create: `packages/core/tests/koan-gates.test.ts`

**Step 1: Copy all koan files**

```bash
cp spike-koans/00-expr.ts packages/core/src/__koans__/
cp spike-koans/01-increment.ts packages/core/src/__koans__/
cp spike-koans/02-build.ts packages/core/src/__koans__/
cp spike-koans/03-traits.ts packages/core/src/__koans__/
cp spike-koans/03a-composition.ts packages/core/src/__koans__/
cp spike-koans/04-normalize.ts packages/core/src/__koans__/
cp spike-koans/04a-structural.ts packages/core/src/__koans__/
cp spike-koans/04b-accessor.ts packages/core/src/__koans__/
cp spike-koans/05-predicates.ts packages/core/src/__koans__/
cp spike-koans/06-select.ts packages/core/src/__koans__/
cp spike-koans/07-map.ts packages/core/src/__koans__/
cp spike-koans/08-replace.ts packages/core/src/__koans__/
cp spike-koans/09-gc.ts packages/core/src/__koans__/
cp spike-koans/10-dirty.ts packages/core/src/__koans__/
cp spike-koans/11-commit.ts packages/core/src/__koans__/
cp spike-koans/12-wrap.ts packages/core/src/__koans__/
cp spike-koans/13-splice.ts packages/core/src/__koans__/
cp spike-koans/14-named.ts packages/core/src/__koans__/
cp spike-koans/15-dagql.ts packages/core/src/__koans__/
cp spike-koans/16-bridge.ts packages/core/src/__koans__/
```

**Step 2: Create koan gate test runner**

The koans currently import from relative paths (e.g., `import { ... } from "./03-traits"`). The frozen copies keep these internal imports — they form a self-contained chain. The gate test simply imports and executes each koan to verify both type-checking and runtime assertions pass.

```typescript
// packages/core/tests/koan-gates.test.ts
import { describe, test } from "vitest";

// Each koan is a self-contained module with assert() calls.
// Importing it runs its assertions. Type-checking it validates types.
// The koans import from each other via relative paths within __koans__/.

describe("koan gates", () => {
  test("00-expr", async () => { await import("../src/__koans__/00-expr"); });
  test("01-increment", async () => { await import("../src/__koans__/01-increment"); });
  test("02-build", async () => { await import("../src/__koans__/02-build"); });
  test("03-traits", async () => { await import("../src/__koans__/03-traits"); });
  test("03a-composition", async () => { await import("../src/__koans__/03a-composition"); });
  test("04-normalize", async () => { await import("../src/__koans__/04-normalize"); });
  test("04a-structural", async () => { await import("../src/__koans__/04a-structural"); });
  test("04b-accessor", async () => { await import("../src/__koans__/04b-accessor"); });
  test("05-predicates", async () => { await import("../src/__koans__/05-predicates"); });
  test("06-select", async () => { await import("../src/__koans__/06-select"); });
  test("07-map", async () => { await import("../src/__koans__/07-map"); });
  test("08-replace", async () => { await import("../src/__koans__/08-replace"); });
  test("09-gc", async () => { await import("../src/__koans__/09-gc"); });
  test("10-dirty", async () => { await import("../src/__koans__/10-dirty"); });
  test("11-commit", async () => { await import("../src/__koans__/11-commit"); });
  test("12-wrap", async () => { await import("../src/__koans__/12-wrap"); });
  test("13-splice", async () => { await import("../src/__koans__/13-splice"); });
  test("14-named", async () => { await import("../src/__koans__/14-named"); });
  test("15-dagql", async () => { await import("../src/__koans__/15-dagql"); });
  test("16-bridge", async () => { await import("../src/__koans__/16-bridge"); });
});
```

**Step 3: Verify koan gates pass on current spike branch**

```bash
cd packages/core && npx vitest run tests/koan-gates.test.ts
```
Expected: All 20 tests pass (koans are self-contained on spike branch).

**Step 4: Commit frozen koans**

```bash
git add -A && git commit -m "test: add 20 frozen koan gate tests from spike-koans-baseline"
```

---

### Task 3: Generate golden tests — arithmetic & literals

**Subagent-parallelizable.** Generate end-to-end golden tests for numeric and literal operations.

**Files:**
- Create: `packages/core/tests/golden/arithmetic.test.ts`

**Context for subagent:** Read the koan files (especially 02-build, 03-traits, 04-normalize, 16-bridge) and the existing `packages/docs/src/examples/num.ts` doc examples. Write tests that follow the canonical flow:

```typescript
import { test, expect } from "vitest";
// These imports will come from @mvfm/core once rebuilt
// For now, write against the koan API surface

test("add two literals", async () => {
  const $ = mvfmU(...stdPlugins);
  const prog = app($.add(3, 4));
  const result = await fold(prog, stdInterpreter);
  expect(result).toBe(7);
});
```

**Test categories to cover (30+ tests):**
- add, sub, mul with literal numbers
- Nested arithmetic: `add(mul(2, 3), sub(10, 4))`
- Deep nesting (5+ levels)
- numLit passthrough
- Division, modulo, negation, abs, floor, ceil, round
- min/max with multiple args
- Zero and identity cases (add 0, mul 1)
- Large numbers, negative numbers
- Type errors: `@ts-expect-error` for `add("x", 1)` at app() boundary

---

### Task 4: Generate golden tests — strings

**Subagent-parallelizable.**

**Files:**
- Create: `packages/core/tests/golden/strings.test.ts`

**Test categories (25+ tests):**
- concat, upper, lower, trim
- template literals with interpolation
- slice, includes, startsWith, endsWith
- split, join, replace
- len
- Nested: `upper(concat("hello", " ", "world"))`
- strLit passthrough
- show(42) → "42", show(true) → "true"
- Type errors: string ops on numbers

---

### Task 5: Generate golden tests — booleans & control flow

**Subagent-parallelizable.**

**Files:**
- Create: `packages/core/tests/golden/booleans-control.test.ts`

**Test categories (30+ tests):**
- and, or, not, implies
- tt, ff literals
- cond: true branch taken, false branch taken
- Nested cond: `cond(and(true, false)).t(...).f(...)`
- begin: sequence of side effects, returns last
- Short-circuit: cond only evaluates taken branch (verify with side-effect tracking)
- boolLit passthrough
- Type errors: boolean ops on numbers

---

### Task 6: Generate golden tests — trait dispatch (eq, ord)

**Subagent-parallelizable.**

**Files:**
- Create: `packages/core/tests/golden/trait-dispatch.test.ts`

**Test categories (30+ tests):**
- eq on numbers: eq(3, 3) → true, eq(3, 4) → false
- eq on strings: eq("a", "a") → true
- eq on booleans: eq(true, true) → true
- neq: neq(3, 4) → true
- Nested trait dispatch: eq(eq(3, 3), eq(5, 5)) → dispatches inner to num/eq, outer to bool/eq
- ord: compare(3, 5) → -1, gt, gte, lt, lte
- Trait dispatch with input schema: eq($.input.x, 1) where x: "number"
- createApp with ordPlugin: proves extensibility beyond StdRegistry
- Type errors: eq with no provider, ambiguous dispatch

---

### Task 7: Generate golden tests — structural & accessors

**Subagent-parallelizable.**

**Files:**
- Create: `packages/core/tests/golden/structural-accessors.test.ts`

**Test categories (25+ tests):**
- Records with CExprs: `{x: add(1, 2), y: 3}` → record with named children
- Tuples: `[add(1, 2), 3]` → tuple with positional children
- Nested records: `{start: {x: 1, y: 2}, end: {x: 3, y: 4}}`
- Accessor chains: `a.x`, `a.b.c`, `a[0]`, `a.b[0].c`
- Deep accessor (7 levels like 04b koan)
- Fold through structural nodes: yields string IDs for named children
- Mixed: record containing tuple containing CExpr
- Type preservation through structural elaboration

---

### Task 8: Generate golden tests — DAG operations

**Subagent-parallelizable.**

**Files:**
- Create: `packages/core/tests/golden/dag-operations.test.ts`

**Test categories (50+ tests):**

*Predicates & Select:*
- byKind, byKindGlob, isLeaf, hasChildCount
- not, and, or combinators
- selectWhere returns correct IDs
- Empty result sets

*Map & Replace:*
- mapWhere renames kind
- mapWhere preserves unmatched
- replaceWhere as kind-only shorthand
- Root mapping changes output type
- Compound predicates in map

*GC:*
- Reachable nodes preserved, unreachable removed
- Diamond DAGs: shared nodes not double-collected
- Chain and tree stress tests

*Dirty/Commit:*
- dirty() → addEntry → commit() round-trip
- removeEntry, swapEntry, rewireChildren, setRoot
- commit throws on dangling references
- gc removes unreachable from dirty

*Wrap:*
- wrapByName inserts wrapper above target
- Root wrap changes root ID
- Wrapper children = [target]

*Splice:*
- spliceWhere removes and reconnects
- Wrap-then-splice round-trip
- Splice root: first child becomes root
- Splice leaf: parent children empty

*Named:*
- name() adds @alias
- byName predicate finds target
- gc removes aliases; gcPreservingAliases keeps them

---

### Task 9: Generate golden tests — dagql pipe

**Subagent-parallelizable.**

**Files:**
- Create: `packages/core/tests/golden/dagql-pipe.test.ts`

**Test categories (20+ tests):**
- Single operation through pipe
- Chained: replace → splice → gc
- Type flow through pipe steps
- Three+ step chains
- pipe with select-based operations
- Integration: mvfm → app → pipe → fold

---

### Task 10: Generate golden tests — fold & interpreters

**Subagent-parallelizable.**

**Files:**
- Create: `packages/core/tests/golden/fold-interpreters.test.ts`

**Test categories (40+ tests):**
- Basic fold: arithmetic tree evaluation
- Memoization: shared DAG node evaluated once (count with side effect)
- Short-circuit: cond only evaluates taken branch
- Async handlers: handler returns promise
- Handler yields: positional (number) and direct ID (string) for structural nodes
- NExpr type inference: `fold(expr, interp)` infers output type without manual annotation
- defaults() merges plugin interpreters
- defaults() with overrides for plugins without defaultInterpreter
- Custom interpreter: user-defined handlers
- 10k-deep chain: stack safety
- Diamond DAG: shared evaluation
- Full pipeline: mvfm → app → dagql → fold

---

### Task 11: Generate golden tests — error handling

**Subagent-parallelizable.**

**Files:**
- Create: `packages/core/tests/golden/error-handling.test.ts`

**Test categories (25+ tests):**
- try/catch: success path, error path
- fail: explicit throw
- attempt: Either-style wrapping
- guard: condition check
- settle: mixed success/failure collection
- Nested try/catch
- Error propagation through gen.throw()
- try/finally: cleanup always runs
- match: error key matching
- Error inside begin(): sequence aborted

---

### Task 12: Generate golden tests — concurrency (fiber)

**Subagent-parallelizable.**

**Files:**
- Create: `packages/core/tests/golden/concurrency.test.ts`

**Test categories (20+ tests):**
- par: tuple form returns all values
- par: map form with concurrency limit
- seq: sequential execution, returns last
- race: first completes wins
- timeout: with fallback
- retry: with delay
- par with shared DAG nodes: memoization across fibers
- Independent fold() calls from within handlers

---

### Task 13: Generate golden tests — state (ST)

**Subagent-parallelizable.**

**Files:**
- Create: `packages/core/tests/golden/state.test.ts`

**Test categories (20+ tests):**
- let/get/set basic flow
- push to mutable array
- Multiple let bindings
- Volatile: ST nodes skip memo cache
- Taint propagation: nodes depending on volatile re-evaluate
- State in loop (while + st)
- State with conditionals

---

### Task 14: Generate golden tests — type errors

**Subagent-parallelizable.**

**Files:**
- Create: `packages/core/tests/golden/type-errors.test.ts`

**Test categories (30+ tests):**

All `@ts-expect-error` negative cases:
- Wrong argument types to arithmetic ops
- Missing plugin for trait dispatch
- Ambiguous trait dispatch
- Wrong schema types
- CExpr used where NExpr expected (and vice versa)
- DirtyExpr used where NExpr expected
- Incompatible map transforms (kind, children, out mismatches)
- Fold with incomplete interpreter
- Access on non-record/non-tuple types
- Missing override for plugin without default interpreter

---

### Task 15: Generate golden tests — edge cases & stress

**Subagent-parallelizable.**

**Files:**
- Create: `packages/core/tests/golden/edge-cases.test.ts`

**Test categories (20+ tests):**
- Empty program (single literal)
- Very deep nesting (100+ levels)
- Wide fanout (node with 50 children)
- Diamond sharing (same subexpr used 10 times)
- 10k-node chain fold (stack safety)
- GC stress: 900-node chain, 8000-node tree
- Interleaved operations: map → gc → wrap → splice → commit → fold
- createApp with no plugins (empty registry)
- createApp with custom plugin tuple

---

### Task 16: Generate golden tests — full pipeline integration

**Subagent-parallelizable.**

**Files:**
- Create: `packages/core/tests/golden/full-pipeline.test.ts`

**Test categories (30+ tests):**

End-to-end tests combining ALL features:
- mvfm(plugins) → $ → construct CExpr → app → dagql transforms → fold → result
- With trait dispatch + structural nodes + accessors
- With error handling inside fold
- With concurrency inside fold
- With state inside fold
- With input schema
- With custom plugins (ordPlugin)
- Multiple folds of same program (memoization isolation)
- Pipeline with every DAG operation
- Realistic programs: calculator, string formatter, conditional data pipeline

---

### Task 17: Verify test fortress compiles and all tests FAIL

This is a critical gate. All golden tests should be written against the public API that doesn't exist yet. They must:
1. Type-check against the koan-defined types (import from `__koans__/16-bridge` or equivalent)
2. Be ready to switch imports to `@mvfm/core` once rebuilt

**Step 1: Run type check on test files**

```bash
npx tsc --noEmit --strict
```
Expected: Golden tests that import from `@mvfm/core` fail (module not found). Koan gates pass (self-contained).

**Step 2: Commit test fortress**

```bash
git add -A && git commit -m "test: complete golden test fortress (500+ tests, all pending)"
```

---

## Phase B: Delete and Rebuild

### Task 18: Delete existing implementation

**Step 1: Archive current state in git**

```bash
git add -A && git commit -m "chore: snapshot before core deletion" --allow-empty
```

**Step 2: Delete existing source and test files**

```bash
rm -rf packages/core/src/*.ts packages/core/src/plugins/ packages/core/src/interpreters/ packages/core/src/__tests__/
rm -rf packages/core/tests/*.test.ts packages/core/tests/interpreters/ packages/core/tests/plugins/
```

**Step 3: Create minimal index.ts placeholder**

```typescript
// packages/core/src/index.ts
// Rebuilt from koan chain. See docs/plans/2026-02-21-issue-293-core-rebuild-plan.md
export {};
```

**Step 4: Commit clean slate**

```bash
git add -A && git commit -m "chore: delete existing core implementation for rebuild"
```

---

### Task 19: Implement koans 00–01 — Expression types & ID generation

**Files:**
- Create: `packages/core/src/expr.ts` — CExpr, NExpr, phantom types, extractors
- Create: `packages/core/src/increment.ts` — Increment type + incrementId runtime
- Modify: `packages/core/src/index.ts` — re-export

**What to build (from koans 00 and 01):**
- `NodeEntry<Kind, ChildIDs, Out>` type
- `RuntimeEntry` interface
- `CREF` symbol for CExpr detection
- `CExpr<O, Kind, Args>` with brand
- `makeCExpr(kind, args)`, `isCExpr(x)`
- Type extractors: `COutOf`, `CKindOf`, `CArgsOf`
- `NExpr<O, RootId, Adj, Ctr>` with brand
- Type extractors: `IdOf`, `AdjOf`, `CtrOf`, `OutOf`
- `makeNExpr(rootId, adj, counter)`
- `IncrementLast<S>`, `Increment<S>` type-level
- `incrementId(s)` runtime

**Validation:** Run koan gates 00 and 01.

```bash
npx vitest run tests/koan-gates.test.ts -t "00-expr"
npx vitest run tests/koan-gates.test.ts -t "01-increment"
```

**Commit:**
```bash
git add -A && git commit -m "feat: expression types and ID generation (koans 00-01)"
```

---

### Task 20: Implement koan 02 — Registry & constructors

**Files:**
- Create: `packages/core/src/registry.ts` — KindSpec, TraitKindSpec, StdRegistry
- Create: `packages/core/src/constructors.ts` — add, mul, sub, eq, numLit, strLit, boolLit
- Modify: `packages/core/src/index.ts`

**What to build (from koan 02):**
- `KindSpec<I, O>`, `TraitKindSpec<O, Mapping>`
- `RegistryEntry` union
- `LiftKind<T>`, `TypeKey<T>` type utilities
- `StdRegistry` full type registry
- Permissive constructors: `add`, `mul`, `sub`, `eq`, `numLit`, `strLit`, `boolLit`

**Validation:** Koan gate 02.

**Commit:**
```bash
git add -A && git commit -m "feat: registry types and constructors (koan 02)"
```

---

### Task 21: Implement koan 03 — Plugin composition (simple)

**Files:**
- Create: `packages/core/src/plugin-simple.ts` — PluginShape, numPlugin, strPlugin, boolPlugin, mvfm
- Modify: `packages/core/src/index.ts`

**What to build (from koan 03):**
- `PluginShape<Ctors, Kinds, Traits>` interface
- `numPlugin`, `strPlugin`, `boolPlugin` definitions
- `mvfm<P>(...plugins)` → `DollarSign<P>` with trait ctor auto-generation
- `UnionToIntersection`, `MergeCtors`, `DollarSign` type utilities

**Validation:** Koan gate 03.

**Commit:**
```bash
git add -A && git commit -m "feat: simple plugin composition (koan 03)"
```

---

### Task 22: Implement koan 03a — Unified plugins & derived registries

**Files:**
- Create: `packages/core/src/plugin.ts` — Unified Plugin type, RegistryOf, map builders, mvfmU
- Modify: `packages/core/src/index.ts`

**What to build (from koan 03a):**
- `TraitDef<O, Mapping>`, `Handler`, `Interpreter` types
- `Plugin<Name, Ctors, Kinds, Traits, Lifts>` unified type with `nodeKinds`, `defaultInterpreter`
- `RegistryOf<P>` — derives type-level registry from plugin tuple
- `buildLiftMap(plugins)`, `buildTraitMap(plugins)`, `buildKindInputs(plugins)`
- `mvfmU<P>(...plugins)` — auto-generates trait constructors
- `numPluginU`, `strPluginU`, `boolPluginU`, `stdPlugins`
- `lt` constructor and `ordPlugin`

**Validation:** Koan gate 03a.

**Commit:**
```bash
git add -A && git commit -m "feat: unified plugins and derived registries (koan 03a)"
```

---

### Task 23: Implement koan 04 — App & elaboration

**Files:**
- Create: `packages/core/src/elaborate.ts` — Type-level elaboration, app(), createApp()
- Modify: `packages/core/src/index.ts`

**What to build (from koan 04):**
- `NeverGuard<T, Then>` type utility
- `ElaborateArg`, `ElaborateExpr`, `ElaborateChildren`, `ElaborateTraitExpr`, `ElaborateArgInfer` types
- `AppResult<Reg, Expr>` type
- Module-level maps: `LIFT_MAP`, `TRAIT_MAP`, `KIND_INPUTS`
- `elaborate(expr, liftMap, traitMap, kindInputs, kindOutputs)` runtime function
- `createApp<P>(...plugins)` → generic app factory
- `app<Expr>(expr)` → StdRegistry app

**Validation:** Koan gate 04.

**Commit:**
```bash
git add -A && git commit -m "feat: app and type-level elaboration (koan 04)"
```

---

### Task 24: Implement koans 04a–04b — Structural & accessors

**Files:**
- Create: `packages/core/src/structural.ts` — Structural elaboration, records, tuples
- Create: `packages/core/src/accessor.ts` — AccessorOverlay, makeCExprProxy
- Modify: `packages/core/src/index.ts`

**What to build (from koans 04a and 04b):**
- `SNodeEntry<Kind, Ch, O>` with flexible children
- `StructuralRegistry` extending StdRegistry
- `DeepResolve<T>`, `ElaborateStructural`, `ElaborateLeaf`, `ElaborateRecordFields` types
- `AccessorOverlay<O>` — proxy-based deep property access
- `makeCExprProxy(kind, args)` runtime
- Structural-aware elaboration that produces named map children for records and positional arrays for tuples

**Validation:** Koan gates 04a and 04b.

**Commit:**
```bash
git add -A && git commit -m "feat: structural elaboration and accessor overlay (koans 04a-04b)"
```

---

### Task 25: Implement koans 05–06 — Predicates & select

**Files:**
- Create: `packages/core/src/predicates.ts` — All 8 predicate types, EvalPred, SelectKeys
- Create: `packages/core/src/select.ts` — selectWhere
- Modify: `packages/core/src/index.ts`

**What to build (from koans 05 and 06):**
- All predicate constructors: `byKind`, `byKindGlob`, `isLeaf`, `hasChildCount`, `not`, `and`, `or`, `byName`
- `EvalPred<P, Entry, ID, Adj>` type-level evaluation
- `SelectKeys<Adj, P>` type-level key computation
- `selectWhere(expr, pred)` → `Set<string & SelectKeys<Adj, P>>`

**Validation:** Koan gates 05 and 06.

**Commit:**
```bash
git add -A && git commit -m "feat: predicates and selectWhere (koans 05-06)"
```

---

### Task 26: Implement koans 07–08 — Map & replace

**Files:**
- Create: `packages/core/src/map.ts` — mapWhere with full type precision
- Create: `packages/core/src/replace.ts` — replaceWhere
- Modify: `packages/core/src/index.ts`

**What to build (from koans 07 and 08):**
- `MapAdj`, `MapOut`, `MatchingEntries` types
- `mapWhere(expr, pred, fn)` with type-preserving transforms
- `ReplaceKind` type
- `replaceWhere(expr, pred, newKind)` as thin wrapper over mapWhere

**Validation:** Koan gates 07 and 08.

**Commit:**
```bash
git add -A && git commit -m "feat: mapWhere and replaceWhere (koans 07-08)"
```

---

### Task 27: Implement koan 09 — Garbage collection

**Files:**
- Create: `packages/core/src/gc.ts` — CollectReachable, gc
- Modify: `packages/core/src/index.ts`

**What to build (from koan 09):**
- `CollectReachable<Adj, Queue, Visited>` type-level forward DFS
- `LiveAdj` mapped type (single pass, avoids exponential blowup)
- Runtime gc using queue-based DFS
- Stress-test safe: handles 900-node chains, 8000-node trees

**Validation:** Koan gate 09.

**Commit:**
```bash
git add -A && git commit -m "feat: forward-reachability GC (koan 09)"
```

---

### Task 28: Implement koans 10–11 — Dirty & commit

**Files:**
- Create: `packages/core/src/dirty.ts` — DirtyExpr, mutation primitives
- Create: `packages/core/src/commit.ts` — gc + commit pipeline
- Modify: `packages/core/src/index.ts`

**What to build (from koans 10 and 11):**
- `DirtyExpr<O, R, Adj, C>` with separate brand
- `dirty()`, `addEntry()`, `removeEntry()`, `swapEntry()`, `rewireChildren()`, `setRoot()`
- `gc()` on DirtyExpr
- `commit()` — validate root exists, all children exist, return NExpr

**Validation:** Koan gates 10 and 11.

**Commit:**
```bash
git add -A && git commit -m "feat: dirty/commit transaction model (koans 10-11)"
```

---

### Task 29: Implement koan 12 — Wrap

**Files:**
- Create: `packages/core/src/wrap.ts` — wrapByName
- Modify: `packages/core/src/index.ts`

**What to build (from koan 12):**
- `RewireParents<Adj, TargetID, WrapperID>` type
- `WrapOneResult` type
- `wrapByName(expr, id, wrapperKind)` — insert wrapper, rewire parents
- Critical: wrapper child NOT self-rewired (add after rewiring)

**Validation:** Koan gate 12.

**Commit:**
```bash
git add -A && git commit -m "feat: wrapByName (koan 12)"
```

---

### Task 30: Implement koan 13 — Splice

**Files:**
- Create: `packages/core/src/splice.ts` — spliceWhere
- Modify: `packages/core/src/index.ts`

**What to build (from koan 13):**
- `SpliceList<C, Adj, Matched>` — recursive child substitution
- `SpliceAdj<Adj, Matched>` — remove matched, reconnect survivors
- `SpliceRoot<R, Adj, Matched>` — root splice
- `spliceWhere(expr, pred)` runtime

**Validation:** Koan gate 13.

**Commit:**
```bash
git add -A && git commit -m "feat: spliceWhere (koan 13)"
```

---

### Task 31: Implement koan 14 — Named aliases

**Files:**
- Create: `packages/core/src/named.ts` — name(), gcPreservingAliases
- Modify: `packages/core/src/index.ts`

**What to build (from koan 14):**
- `NameAlias<Name, TargetID, Out>` entry type
- `name(expr, alias, targetId)` — adds @alias without consuming counter
- `byName(name)` predicate integration
- `gcPreservingAliases()` — preserves alias entries through gc

**Validation:** Koan gate 14.

**Commit:**
```bash
git add -A && git commit -m "feat: named aliases (koan 14)"
```

---

### Task 32: Implement koan 15 — DagQL pipe

**Files:**
- Create: `packages/core/src/dagql.ts` — pipe with full type precision
- Modify: `packages/core/src/index.ts`

**What to build (from koan 15):**
- `pipe(expr, ...ops)` — chained operations with full type flow
- Each operation is `(expr: NExpr) => NExpr`
- Type precision: removed keys error after splice, not `any`

**Validation:** Koan gate 15.

**Commit:**
```bash
git add -A && git commit -m "feat: dagql pipe (koan 15)"
```

---

### Task 33: Implement koan 16 — Fold & bridge

**Files:**
- Create: `packages/core/src/fold.ts` — Trampoline fold, handler protocol
- Create: `packages/core/src/defaults.ts` — defaults() interpreter composition
- Modify: `packages/core/src/index.ts`

**What to build (from koan 16):**
- `Handler` type: `async function* (entry) => AsyncGenerator<number | string, unknown, unknown>`
- `Interpreter` = `Record<string, Handler>`
- `fold()` — trampoline-based async execution:
  - Yields: `number` (positional child index) or `string` (direct node ID for structural children)
  - Memoization: cache evaluated node results
  - Stack-safe: explicit stack, not recursive
  - Overloaded: `fold(expr, interp)` and `fold(rootId, adj, interp)`
  - NExpr overload infers output type from phantom type
- `defaults(plugins)` — merge plugin interpreters + core handlers
  - Accepts unified `Plugin[]` from 03a
  - Type-enforced: plugins without `defaultInterpreter` require override

**Validation:** Koan gate 16 (this is the big one — 38+ runtime assertions).

**Commit:**
```bash
git add -A && git commit -m "feat: fold and defaults (koan 16)"
```

---

### Task 34: Implement production extensions — ST volatile/taint

**Files:**
- Modify: `packages/core/src/fold.ts` — Add VOLATILE_KINDS, taint tracking

**What to build:**
- `VOLATILE_KINDS` set (core/lambda_param, st/get, etc.)
- Memoization skip for volatile nodes
- Taint propagation: nodes depending on volatile children are not cached
- `createFoldState()` for sharing cache across multiple folds

**Validation:** Golden tests in `state.test.ts` and `fold-interpreters.test.ts`.

**Commit:**
```bash
git add -A && git commit -m "feat: ST volatile/taint tracking in fold"
```

---

### Task 35: Implement production extensions — error propagation

**Files:**
- Modify: `packages/core/src/fold.ts` — Add gen.throw() support

**What to build:**
- `gen.throw()` propagation through generator stack
- Integration with error/try (catches), error/fail (throws)
- Error state tracking in fold trampoline

**Validation:** Golden tests in `error-handling.test.ts`.

**Commit:**
```bash
git add -A && git commit -m "feat: error propagation in fold"
```

---

### Task 36: Implement production extensions — fiber parallelism

**Files:**
- Modify: `packages/core/src/fold.ts` — Add independent fold calls

**What to build:**
- Independent `fold()` calls from within handlers (fiber/par, fiber/race)
- Shared fold state (cache) across parallel folds
- Promise.all/Promise.race integration

**Validation:** Golden tests in `concurrency.test.ts`.

**Commit:**
```bash
git add -A && git commit -m "feat: fiber parallelism in fold"
```

---

### Task 37: Implement production extensions — scoped lambdas

**Files:**
- Modify: `packages/core/src/fold.ts` — Add scoped lambda support

**What to build:**
- Yield type widened to `number | string | { child: number, scope: bindings }`
- `recurseScoped()` effect for scoped evaluation
- Lambda param resolution from scope stack

**Validation:** Golden tests involving lambdas (map/filter/reduce callbacks).

**Commit:**
```bash
git add -A && git commit -m "feat: scoped lambdas in fold"
```

---

### Task 38: Implement plugin interpreters

**Files:**
- Create: `packages/core/src/interpreters/core.ts` — Core interpreter (cond, begin, literal, input, record, tuple, prop_access, lambda_param, program)
- Create: `packages/core/src/plugins/num/interpreter.ts`
- Create: `packages/core/src/plugins/str/interpreter.ts`
- Create: `packages/core/src/plugins/boolean/interpreter.ts`
- Create: `packages/core/src/plugins/eq/interpreter.ts`
- Create: `packages/core/src/plugins/ord/interpreter.ts`
- Create: `packages/core/src/plugins/error/interpreter.ts`
- Create: `packages/core/src/plugins/fiber/interpreter.ts`
- Create: `packages/core/src/plugins/st/interpreter.ts`
- Create: `packages/core/src/plugins/control/interpreter.ts`
- Create: `packages/core/src/plugins/show/interpreter.ts`
- Create plugin index files with `build(ctx)` + `defaultInterpreter`

**What to build:**
All handlers use positional yield (not named field access):
```typescript
"core/cond": async function* (_entry) {
  const pred = (yield 0) as boolean;
  return pred ? yield 1 : yield 2;
}
```

Each plugin must conform to the Plugin interface from koan 03a:
- `name`, `nodeKinds`, `ctors`, `kinds`, `traits`, `lifts`, `defaultInterpreter`

**Validation:** Golden tests across all test files should now pass.

**Commit:**
```bash
git add -A && git commit -m "feat: all plugin interpreters (positional yield)"
```

---

### Task 39: Wire up full public API

**Files:**
- Modify: `packages/core/src/index.ts` — Complete barrel export

**What to build:**
- Re-export everything the golden tests and external plugins need
- Ensure `@mvfm/core` import path works for all consumers
- Match the export surface needed by `packages/plugin-*/` and `packages/docs/`

**Validation:**
```bash
npm run build && npm run check && npm test
```

**Commit:**
```bash
git add -A && git commit -m "feat: complete public API surface"
```

---

## Phase C: Validation

### Task 40: Final validation sweep

**Step 1: All koan gates pass**
```bash
npx vitest run tests/koan-gates.test.ts
```

**Step 2: All golden tests pass**
```bash
npx vitest run tests/golden/
```

**Step 3: Full build pipeline**
```bash
npm run build && npm run check && npm test
```

**Step 4: Type check — no `any` or `as` in production**
```bash
grep -r "as " packages/core/src/ --include="*.ts" | grep -v __koans__ | grep -v test
grep -r ": any" packages/core/src/ --include="*.ts" | grep -v __koans__ | grep -v test
```
Expected: Zero matches (or justified exceptions documented).

**Step 5: Stack safety verification**
```bash
npx vitest run tests/golden/edge-cases.test.ts -t "10k"
```

**Step 6: Commit final state**
```bash
git add -A && git commit -m "chore: all validation gates pass"
```

---

## Task Dependency Graph

```
Task 1 (infra) → Task 2 (koans)
Task 2 → Tasks 3–16 (golden tests, ALL PARALLEL)
Tasks 3–16 → Task 17 (verify fortress)
Task 17 → Task 18 (delete)
Task 18 → Task 19 (00–01) → Task 20 (02) → Task 21 (03) → Task 22 (03a) → Task 23 (04) → Task 24 (04a–b)
Task 24 → Task 25 (05–06) → Task 26 (07–08) → Task 27 (09) → Task 28 (10–11) → Task 29 (12) → Task 30 (13) → Task 31 (14) → Task 32 (15) → Task 33 (16)
Task 33 → Tasks 34–37 (production extensions, SEQUENTIAL)
Task 37 → Task 38 (interpreters) → Task 39 (API) → Task 40 (validation)
```

**Golden test generation (Tasks 3–16) is embarrassingly parallel — dispatch 14 subagents simultaneously.**

**Implementation (Tasks 19–33) is strictly sequential — each koan depends on all previous.**
