# Issue #290: DAG Builders v2 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the old tree-based foldAST with the DAG fold model. Build precise-typed CExpr builders for every plugin, DAG interpreters for every node kind, delete all old code, and ship with rigorous positive+negative type tests for every operation.

**Architecture:**
- **Plugins** are `PluginShape<Ctors, Instances>` objects: a `ctors` record of builder functions + an `instances` tuple of `TraitInstance` entries.
- **Builders** are factory functions from `cexpr-builders.ts` (`binaryOf`, `unaryOf`, etc.) that produce `CExpr` with content-addressed IDs, phantom-typed adjacency maps, and `__outType` tags for runtime trait dispatch.
- **Typeclass dispatch** uses `composeEq`/`composeOrd`/etc. from koan 03-traits: `TraitInstance<ForType, Kind>` links a phantom type to a node kind, `ComposedEq<Instances>` uses `NoInfer<O>` on the right argument to prevent type widening, `ResolveKind<O, Instances>` selects the correct kind at the type level.
- **Composition** via `mvfm(...plugins)`: spreads all constructor records + composes trait dispatchers. The `$` record has all constructors + dispatched trait methods (eq, ord, show, etc.).
- **Evaluation:** `fold()` accepts `NExpr` (user calls `app()` first). `PluginDef + defaults()` compose interpreters.
- **Smart builders** that auto-wrap raw values (`add(3, 4)` instead of `add(literal(3), literal(4))`) are explored but not required — the literal ceremony is acceptable.

**Tech Stack:** TypeScript 5.x strict mode, Vitest, phantom-typed generics with template literal types.

**Baseline commit:** `e324211` (feat: add koan 03-traits and renumber koans)

**Branch:** `issue-290` (rewound to baseline + traits koan)

---

## Non-Negotiable Rules

1. **Every operation gets a positive AND negative type test.** Positive: assign the correct type. Negative: `@ts-expect-error` for wrong types. Both CExpr (pre-normalize) and NExpr (post-normalize) levels.
2. **No `as any` casts in user-facing code.** Internal factory implementations may use `as any` at the final `makeCExpr` return (this is the one choke point), but plugin build records and tests must be cast-free.
3. **No `unknown` in function parameter positions** (except the `O` phantom slot in `CExpr<unknown, Id, Adj>`). Every wrapper must be generic so call-site inference preserves precision.
4. **No `node()` function.** No `BuildContext`. Builders are factory-returned functions. `mvfm()` exists but is the koan-03 version (record spread + trait composition), NOT the old closure-based builder pattern.
5. **Every node kind in main's codebase must have a DAG interpreter handler.** Missing handler = build failure.
6. **`npm run build && npm run check && npm test` must pass at every commit.**
7. **Files under 300 lines.** Split when approaching.
8. **fold tests must actually fold.** Every plugin's test suite must include at least one `fold()` call that executes the full pipeline: `build → app → fold → expect(result)`.
9. **All builder factories must pass `outType` to `makeCExpr`.** This is how runtime trait dispatch works — the `__outType` tag on CExpr tells `composeEq` etc. which trait instance to use.

## Key Pattern: Trait Dispatch (from koan 03-traits)

The trait system is proven in `packages/core/src/dag/03-traits.ts`. Study it thoroughly before implementing plugins. Key concepts:

```ts
// TraitInstance links a phantom type to a node kind
interface TraitInstance<ForType, Kind extends string> {
  readonly _forType: ForType;       // phantom — never read at runtime
  readonly kind: Kind;
  readonly forTypeTag: string;      // runtime: matches CExpr.__outType
  readonly ctor: (left, right) => CExpr<any, any, any>;
}

// ComposedEq: polymorphic eq with compile-time safety
interface ComposedEq<Instances> {
  <O extends SupportedTypes<Instances>, ...>(
    left: CExpr<O, LId, LAdj>,
    right: CExpr<NoInfer<O>, RId, RAdj>,  // NoInfer prevents widening!
  ): CExpr<boolean, ..., Record<..., NodeEntry<ResolveKind<O, Instances>, ...>>>
}

// PluginShape: constructors + trait instances
interface PluginShape<Ctors, Instances> {
  readonly ctors: Ctors;
  readonly instances: Instances;
}

// mvfm: compose plugins into $
function mvfm(...plugins): MergeCtors<...> & { eq: ComposedEq<CollectInstances<...>> }
```

**Critical invariant:** Every builder function must pass the correct `outType` string to `makeCExpr`:
- `numLit(3)` → `makeCExpr(..., "number")`
- `add(a, b)` where output is number → `makeCExpr(..., "number")`
- `eq(a, b)` where output is boolean → `makeCExpr(..., "boolean")`
- `show(a)` where output is string → `makeCExpr(..., "string")`

The builder factories (`binaryOf`, `unaryOf`, etc.) need an `outType` parameter alongside `Kind` and `O`.

## What Exists at Baseline

Already done and tested:
- **Koans 00-15**: CExpr/NExpr types (with `__outType`), content-addressed IDs, **trait/typeclass composition** (03-traits), normalize (`app()`), predicates, selectWhere, mapWhere, replaceWhere, GC, dirty, commit, wrap, splice, named, pipe
- **fold.ts**: Trampoline evaluator with memoization, volatile/taint, fiber parallelism, scoped lambdas, error propagation
- **PluginDef + defaults()**: Plugin interface with `name`, `nodeKinds`, `defaultInterpreter()`
- **6 test files**: fold, fold-volatile, fold-fiber, fold-lambda, fold-error, fold-defaults

What does NOT exist yet:
- CExpr builder factories (cexpr-builders.ts)
- Plugin DAG interpreters
- Plugin builder records with trait instances
- Core DAG interpreter
- Integration tests with trait dispatch
- Deletion of old tree-based code
- Updated barrel exports

---

## Tasks

### Task 1: Create `cexpr-builders.ts` with precise builder factories

**Files:**
- Create: `packages/core/src/dag/cexpr-builders.ts`

**What to build:**
Builder factories that produce CExpr nodes with full generic type precision. Each factory takes a node `Kind` string and an `outType` string, and returns a function that accepts CExpr children and returns a new CExpr with a content-addressed ID computed as a template literal type.

Required factories:
- `literalNode<const T>(value, outType)` — `core/literal` with value in ID. **CRITICAL: must use `<const T>` for literal type inference.** Also needs outType (e.g., `"number"`, `"string"`, `"boolean"`).
- `nullaryOf<Kind, O>(kind, outType)` — 0 children, out=undefined
- `nullaryWithOutOf<Kind, O>(kind, outType)` — 0 children, string out value embedded in ID
- `unaryOf<Kind, O>(kind, outType)` — 1 child, out=undefined
- `unaryWithOutOf<Kind, O>(kind, outType)` — 1 child, string out value
- `binaryOf<Kind, O>(kind, outType)` — 2 children, out=undefined
- `ternaryOf<Kind, O>(kind, outType)` — 3 children, out=undefined
- `variadicOf<Kind, O>(kind, outType)` — N children, out=undefined

All factories MUST pass `outType` to `makeCExpr(id, adj, outType)`.

Type helpers to export: `JoinIds`, `MergeAdjs`, `ChildIds`, `Serialize`.

**ID format:**
- Leaf: `` `${kind}[${JSON.stringify(out)}]` `` (e.g., `core/literal[3]`, `boolean/tt[undefined]`)
- Branch: `` `${kind}(${childId1},${childId2},...)` `` (e.g., `num/add(core/literal[3],core/literal[4])`)

**Pattern for each factory** (example: binaryOf):
```ts
export function binaryOf<Kind extends string, O>(kind: Kind, outType: string) {
  return <LA, LId extends string, RA, RId extends string>(
    left: CExpr<unknown, LId, LA>,
    right: CExpr<unknown, RId, RA>,
  ): CExpr<
    O,
    `${Kind}(${LId},${RId})`,
    LA & RA & Record<`${Kind}(${LId},${RId})`, NodeEntry<Kind, [LId, RId], O>>
  > => {
    // ... runtime: compute id, merge adj, call makeCExpr(id, adj, outType)
  };
}
```

**Verification:** Write a type-check-only test file `tests/dag/cexpr-builders.test.ts` that:
- Creates literals and verifies exact ID types (positive + negative)
- Creates binary/unary/ternary/variadic nodes and verifies IDs
- Verifies adj entries have correct kinds, children tuples, and out types
- Verifies two different programs have different types
- Verifies `@ts-expect-error` on wrong IDs, wrong kinds, wrong children, non-existent adj keys
- Verifies `__outType` is set correctly at runtime
- Includes at least one `fold()` call proving the builders produce fold-compatible output

**Definition of done:** `npm run build` passes, test file has ≥10 `@ts-expect-error` negative assertions, ≥10 positive assertions, fold works.

---

### Task 2: Create core DAG interpreter

**Files:**
- Create: `packages/core/src/dag/core-interpreter.ts`

**What to build:**
An interpreter factory `createCoreDagInterpreter()` that returns handlers for core node kinds:
- `core/literal` — returns `entry.out`
- `core/cond` — evaluates predicate (child 0), then evaluates child 1 (truthy) or child 2 (falsy)
- `core/discard` — evaluates child, returns undefined
- `core/begin` — evaluates all children sequentially, returns last
- `core/tuple` — evaluates all children, returns array
- `core/lambda_param` — reads from scope via `ctx.getScope()`
- `core/rec` / `core/rec_call` — recursive function support

Also create the core PluginDef:
```ts
export const corePlugin: PluginDef = {
  name: "core",
  nodeKinds: ["core/literal", "core/cond", "core/discard", "core/begin", "core/tuple", "core/lambda_param", "core/rec", "core/rec_call"],
  defaultInterpreter: createCoreDagInterpreter,
};
```

**Verification:** Test file `tests/dag/core-interpreter.test.ts`:
- literal returns value
- cond branches correctly
- begin returns last value
- tuple returns array
- At least 2 fold() integration tests

**Definition of done:** All core node kinds have handlers, tests pass with fold().

---

### Task 3: Create num plugin (interpreter + builders + trait instances)

**Files:**
- Create: `packages/core/src/plugins/num/dag-interpreter.ts`
- Create: `packages/core/src/plugins/num/dag-builders.ts`
- Create: `packages/core/src/plugins/num/dag-index.ts` (PluginDef + PluginShape)
- Create: `packages/core/tests/dag/num.test.ts`

**What to build:**

**Interpreter** — handlers for all 19 num node kinds:
`num/add`, `num/sub`, `num/mul`, `num/div`, `num/mod`, `num/neg`, `num/abs`, `num/floor`, `num/ceil`, `num/round`, `num/min`, `num/max`, `num/eq`, `num/compare`, `num/zero`, `num/one`, `num/show`, `num/top`, `num/bottom`

Semantics:
- Binary ops (add, sub, mul, div, mod, min, max, eq, compare): evaluate 2 children
- Unary ops (neg, abs, floor, ceil, round, show): evaluate 1 child
- Nullary constants (zero, one, top, bottom): return fixed values (0, 1, Infinity, -Infinity)
- `num/literal` is NOT a kind — numbers go through `core/literal`

**Builder record + trait instances:**
```ts
import { binaryOf, unaryOf, nullaryOf } from "../../dag/cexpr-builders";
import type { TraitInstance, PluginShape } from "../../dag/03-traits";

// Builders — all pass "number" as outType (except eq→"boolean", show→"string")
const numLit = literalNode; // from cexpr-builders, outType="number"
const numAdd = binaryOf<"num/add", number>("num/add", "number");
const numEq = binaryOf<"num/eq", boolean>("num/eq", "boolean");
const numShow = unaryOf<"num/show", string>("num/show", "string");
// ... etc.

export const numBuilders = { numLit, add: numAdd, sub: numSub, ... } as const;

// Trait instances — link number type to specific node kinds
export const numEqInstance: TraitInstance<number, "num/eq"> = {
  _forType: 0 as unknown as number,
  kind: "num/eq",
  forTypeTag: "number",
  ctor: numEq,
};
// Similar for ord, show, semiring, bounded, semigroup...

export const numPlugin: PluginShape<typeof numBuilders, readonly [typeof numEqInstance, ...]> = {
  ctors: numBuilders,
  instances: [numEqInstance, numOrdInstance, numShowInstance, ...] as const,
};
```

**Tests** — `tests/dag/num.test.ts`:
- **For EVERY operation**: at least one fold() test proving correct result
- **Type tests for representative ops**: positive + negative `@ts-expect-error` for IDs, adj, output types
- **DagQL test**: at least one selectWhere/replaceWhere example on a num expression
- **Cross-type distinctness**: `num/add` output is `number`, not `boolean` or `string`
- **__outType check**: verify `numLit(3).__outType === "number"`, `numEq(a,b).__outType === "boolean"`

**Definition of done:** All 19 kinds have handlers, all 19 have fold() tests, ≥6 `@ts-expect-error` negatives, build passes.

---

### Task 4: Create boolean plugin (interpreter + builders + trait instances)

**Files:**
- Create: `packages/core/src/plugins/boolean/dag-interpreter.ts`
- Create: `packages/core/src/plugins/boolean/dag-builders.ts`
- Create: `packages/core/src/plugins/boolean/dag-index.ts`
- Create: `packages/core/tests/dag/boolean.test.ts`

**What to build:**

**Interpreter** — handlers for all 10 boolean node kinds:
`boolean/and`, `boolean/or`, `boolean/not`, `boolean/eq`, `boolean/ff`, `boolean/tt`, `boolean/implies`, `boolean/show`, `boolean/top`, `boolean/bottom`

**Builder record + trait instances:**
All boolean ops output `boolean` (outType="boolean"), except `show` → `string`.

Trait instances: `boolEqInstance: TraitInstance<boolean, "boolean/eq">`, plus bounded, heytingAlgebra.

**Tests:** fold() for every op, positive + negative types, cross-type distinctness (boolean output ≠ number).

**Definition of done:** All 10 kinds handled and tested.

---

### Task 5: Create str plugin (interpreter + builders + trait instances)

**Files:**
- Create: `packages/core/src/plugins/str/dag-interpreter.ts`
- Create: `packages/core/src/plugins/str/dag-builders.ts`
- Create: `packages/core/src/plugins/str/dag-index.ts`
- Create: `packages/core/tests/dag/str.test.ts`

**What to build:**

**Interpreter** — handlers for all 17 str node kinds:
`str/template`, `str/concat`, `str/upper`, `str/lower`, `str/trim`, `str/slice`, `str/includes`, `str/startsWith`, `str/endsWith`, `str/split`, `str/join`, `str/replace`, `str/len`, `str/eq`, `str/show`, `str/append`, `str/mempty`

Note: `str/template` stores the template strings array in `entry.out` and children are the interpolated expressions. `str/slice` takes (string, start, end) — 3 children via `ternaryOf`. Most others are binary or unary.

Trait instances: `strEqInstance: TraitInstance<string, "str/eq">`, plus show, semigroup, monoid.

**Tests:** fold() for every op, types for representative ops, `__outType` checks.

**Definition of done:** All 17 kinds handled and tested.

---

### Task 6: Create typeclass dispatch plugins (eq, ord, show, semiring, semigroup, monoid, bounded, heytingAlgebra)

**Files:**
- Create: `packages/core/src/plugins/eq/dag-index.ts` (PluginDef + dispatch builder)
- Create: `packages/core/src/plugins/ord/dag-index.ts`
- Create: `packages/core/src/plugins/show/dag-index.ts`
- Create: `packages/core/src/plugins/semiring/dag-index.ts`
- Create: `packages/core/src/plugins/semigroup/dag-index.ts`
- Create: `packages/core/src/plugins/monoid/dag-index.ts`
- Create: `packages/core/src/plugins/bounded/dag-index.ts`
- Create: `packages/core/src/plugins/heyting-algebra/dag-index.ts`
- Create: `packages/core/tests/dag/typeclass-dispatch.test.ts`

**What to build:**

Each typeclass plugin follows the koan 03-traits pattern:

1. **eq** — `composeEq(instances)` produces polymorphic `$.eq()`. The eq plugin also owns `eq/neq` (1 node kind: negate the result of dispatched eq). PluginDef has `nodeKinds: ["eq/neq"]`.

2. **ord** — `composeOrd(instances)` produces polymorphic `$.compare()`, `$.gt()`, `$.gte()`, `$.lt()`, `$.lte()`. The ord plugin owns 4 node kinds: `ord/gt`, `ord/gte`, `ord/lt`, `ord/lte`. These are derived: `gt(a,b)` builds `compare(a,b)` then wraps in `ord/gt` (which checks `result > 0`).

3. **show** — `composeShow(instances)` dispatches to type-specific show. Zero own node kinds.

4. **semiring** — `composeSemiring(instances)` dispatches `add` and `mul` to type-specific kinds. Zero own node kinds.

5. **semigroup** — `composeSemigroup(instances)` dispatches `append`. Zero own node kinds.

6. **monoid** — `composeMonoid(instances)` dispatches `mempty`. Zero own node kinds.

7. **bounded** — `composeBounded(instances)` dispatches `top` and `bottom`. Zero own node kinds.

8. **heytingAlgebra** — `composeHeytingAlgebra(instances)` dispatches `conj`, `disj`, `not`, `ff`, `tt`, `implies`. Zero own node kinds.

**The `composeX` pattern** (generalize from `composeEq` in 03-traits):
```ts
// Each trait needs its own TraitInstance variant and ComposedX interface
// Follow the EXACT pattern from 03-traits: NoInfer on the right argument,
// SupportedTypes/ResolveKind for type narrowing

// For unary traits (show): only one argument, no NoInfer needed
// For binary traits (eq, ord, semiring, semigroup): NoInfer on right arg
// For nullary traits (bounded, monoid): no arguments, just dispatch by type tag
```

**Integration with mvfm:** The `mvfm()` function needs to be extended (or a new version created) to compose ALL trait dispatchers, not just `eq`. The `DollarSign` type becomes:
```ts
type DollarSign<Plugins> = MergeCtors<Plugins> & {
  eq: ComposedEq<CollectInstances<Plugins, "eq">>,
  compare: ComposedOrd<CollectInstances<Plugins, "ord">>,
  show: ComposedShow<CollectInstances<Plugins, "show">>,
  add: ComposedSemiring<CollectInstances<Plugins, "semiring">>["add"],
  // ... etc
};
```

**Tests** — `tests/dag/typeclass-dispatch.test.ts`:
- `eq(numLit(3), numLit(4))` → `num/eq` kind, boolean output
- `eq(strLit("a"), strLit("b"))` → `str/eq` kind, boolean output
- `eq(numLit(3), strLit("b"))` → `@ts-expect-error` (mixed types)
- `eq` with no instances → `@ts-expect-error` (never-typed)
- Nested eq: `eq(eq(num,num), eq(num,num))` dispatches outer to `bool/eq`
- At least one fold() test per dispatched trait
- Positive + negative type assertions for resolved node kinds

**Definition of done:** All 8 typeclass plugins have PluginDefs, dispatch produces correct node kinds at type and runtime level, ≥10 `@ts-expect-error` negatives.

---

### Task 7: Create error plugin (interpreter + builders)

**Files:**
- Create: `packages/core/src/plugins/error/dag-interpreter.ts`, `dag-builders.ts`, `dag-index.ts`
- Create: `packages/core/tests/dag/error.test.ts`

**What to build:**

**Interpreter** — 5 node kinds: `error/try`, `error/fail`, `error/attempt`, `error/guard`, `error/settle`

Semantics (from fold-error.test.ts at baseline):
- `error/fail`: throws error with `entry.out` as message or evaluates child as error value
- `error/try`: evaluates child 0, catches errors, evaluates child 1 (recovery) with error in scope
- `error/attempt`: evaluates child, returns `{ ok: value, err: undefined }` or `{ ok: undefined, err: error }`
- `error/guard`: evaluates condition (child 0), if falsy throws error from child 1
- `error/settle`: evaluates all children, collects results as attempt-style objects

**Tests:** fold() for every op including error paths, type assertions.

**Definition of done:** All 5 kinds handled and tested.

---

### Task 8: Create control plugin (interpreter + builders)

**Files:**
- Create: `packages/core/src/plugins/control/dag-interpreter.ts`, `dag-builders.ts`, `dag-index.ts`
- Create: `packages/core/tests/dag/control.test.ts`

**What to build:**

**Interpreter** — 2 node kinds: `control/each`, `control/while`

- `control/each`: evaluates child 0 (collection), iterates calling child 1 (body) for each element with element in scope
- `control/while`: evaluates child 0 (condition) in loop, executes child 1 (body) while truthy

**Tests:** fold() for each/while with side effects (use st for verification).

**Definition of done:** Both kinds handled and tested.

---

### Task 9: Create fiber plugin (interpreter + builders)

**Files:**
- Create: `packages/core/src/plugins/fiber/dag-interpreter.ts`, `dag-builders.ts`, `dag-index.ts`
- Create: `packages/core/tests/dag/fiber.test.ts`

**What to build:**

**Interpreter** — 4 node kinds: `fiber/par_map`, `fiber/race`, `fiber/timeout`, `fiber/retry`

- `fiber/par_map`: parallel map with bounded concurrency. Uses `foldFrom()` for parallel evaluation.
- `fiber/race`: evaluates all children in parallel, returns first to resolve
- `fiber/timeout`: evaluates child 0, races against timeout (child 1 = ms, child 2 = fallback)
- `fiber/retry`: evaluates child 0 up to N times (N from entry.out or child 1)

**Tests:** fold() for each op, parallel behavior verification.

**Definition of done:** All 4 kinds handled and tested.

---

### Task 10: Create st plugin (interpreter + builders)

**Files:**
- Create: `packages/core/src/plugins/st/dag-interpreter.ts`, `dag-builders.ts`, `dag-index.ts`
- Create: `packages/core/tests/dag/st.test.ts`

**What to build:**

**Interpreter** — 4 node kinds: `st/let`, `st/get`, `st/set`, `st/push`

- `st/let`: evaluates child (initial value), stores in mutable ref (ref name in `entry.out`)
- `st/get`: reads ref (ref name in `entry.out`). **Volatile** — always re-evaluates.
- `st/set`: evaluates child (new value), writes to ref
- `st/push`: evaluates child (value), pushes to ref (array)

**Builder record:** The st plugin needs a factory function (not a plain record) because `let` produces a ref object with `.get()`, `.set()`, `.push()` methods that share a ref name. The factory must use generic wrappers:

```ts
export function createStBuilders() {
  let refCounter = 0;
  const stLet = unaryWithOutOf<"st/let", unknown>("st/let", "object");
  const stGet = nullaryWithOutOf<"st/get", unknown>("st/get", "object");
  const stSet = unaryWithOutOf<"st/set", unknown>("st/set", "object");
  const stPush = unaryWithOutOf<"st/push", unknown>("st/push", "object");

  return {
    let: <CA, CId extends string>(
      initial: CExpr<unknown, CId, CA>,
      refName?: string,
    ) => {
      const ref = refName ?? `st_${refCounter++}`;
      return {
        init: stLet(initial, ref),
        get: () => stGet(ref),
        set: <VA, VId extends string>(value: CExpr<unknown, VId, VA>) =>
          stSet(value, ref),
        push: <VA, VId extends string>(value: CExpr<unknown, VId, VA>) =>
          stPush(value, ref),
        ref,
      };
    },
  };
}
```

**CRITICAL:** The `set` and `push` wrappers MUST be generic (`<VA, VId extends string>`) to avoid type erasure. Non-generic wrappers with `CExpr<unknown, string, unknown>` parameters would widen all types.

**Tests:** fold() for let/get/set/push cycle, volatile behavior of get, type precision of generic wrappers.

**Definition of done:** All 4 kinds handled and tested, volatile behavior verified.

---

### Task 11: Integration tests — full pipeline with traits + DagQL

**Files:**
- Create: `packages/core/tests/dag/integration.test.ts`
- Create: `packages/core/tests/dag/type-precision.test.ts`

**What to build:**

**integration.test.ts** — Runtime integration (follows koan 16-bridge pattern):
- `mvfm(numPlugin, strPlugin, boolPlugin)` → $ with trait dispatch
- `$.eq(numLit(3), numLit(4))` → fold → false
- `$.eq(strLit("a"), strLit("a"))` → fold → true
- Nested eq: `$.eq($.eq(num,num), $.eq(num,num))` → dispatches outer to bool/eq → fold
- Build multi-plugin expression, normalize, DagQL transform, fold
- DagQL: selectWhere by kind, replaceWhere + fold, pipe with transforms
- Error handling: error/try wrapping num expression
- ST: mutable counter with let/get/set

**type-precision.test.ts** — Type-level rigor:
- Trait dispatch produces correct node kinds: `$.eq(numLit, numLit)` adj has `"num/eq"` kind
- `@ts-expect-error`: `$.eq(numLit, strLit)` — mixed types
- `@ts-expect-error`: `$.eq(strLit, strLit)` when only numPlugin loaded — unregistered type
- Cross-plugin expressions: num + boolean in same tree, types stay precise
- Normalized types: after app(), verify IdOf, AdjOf, OutOf
- `@ts-expect-error` for: wrong IDs, wrong kinds, wrong children order, non-existent adj keys, wrong output types

**Minimum counts:**
- integration.test.ts: ≥15 `expect()` assertions
- type-precision.test.ts: ≥20 `@ts-expect-error` negative assertions, ≥20 positive assertions

**Definition of done:** Both files pass, no type cheats.

---

### Task 12: Delete old tree-based code and update exports

**Files:**
- Modify: `packages/core/src/index.ts` — update barrel exports
- Delete: All old tree-based source files (interpreters/, old plugin files, foldAST, etc.)
- Modify: `packages/core/tests/` — delete old test files

**What to do:**

1. List all files that exist on main but are NOT part of the DAG model
2. Delete them
3. Update `packages/core/src/index.ts` to export:
   - All DAG koan modules (00-expr through 15-pipe)
   - `cexpr-builders` (builders + type helpers)
   - `fold` (fold, defaults, PluginDef, Handler, Interpreter)
   - `core-interpreter` (createCoreDagInterpreter, corePlugin)
   - Each plugin's dag-index.ts
4. Verify no old imports remain

**Definition of done:** `npm run build` clean, `npm test` all pass, no references to old tree code.

---

### Task 13: Final verification and PR

**Steps:**
1. Run `npm run build && npm run check && npm test` — must be green
2. Verify test count: should have ≥100 test cases across all files
3. Verify `@ts-expect-error` count: grep for it, should be ≥40 across the test suite
4. Run `npx tsc --noEmit` on the test files to verify type assertions compile
5. Create PR with:
   - `Closes #290`
   - Summary of what changed
   - Test evidence

**Definition of done:** CI green, PR created.

---

## Operation Coverage Checklist

The implementing agent MUST verify every operation in this list has both an interpreter handler AND a fold() test:

### Core (8+ kinds)
- [ ] `core/literal` — returns stored value
- [ ] `core/cond` — conditional branching
- [ ] `core/discard` — evaluate and discard
- [ ] `core/begin` — sequential, return last
- [ ] `core/tuple` — evaluate all, return array
- [ ] `core/lambda_param` — scope lookup (volatile)
- [ ] `core/rec` — recursive function
- [ ] `core/rec_call` — recursive call

### Num (19 kinds)
- [ ] `num/add` — addition
- [ ] `num/sub` — subtraction
- [ ] `num/mul` — multiplication
- [ ] `num/div` — division
- [ ] `num/mod` — modulo
- [ ] `num/neg` — negation
- [ ] `num/abs` — absolute value
- [ ] `num/floor` — floor
- [ ] `num/ceil` — ceiling
- [ ] `num/round` — round
- [ ] `num/min` — minimum
- [ ] `num/max` — maximum
- [ ] `num/eq` — equality
- [ ] `num/compare` — three-way compare
- [ ] `num/zero` — zero constant
- [ ] `num/one` — one constant
- [ ] `num/show` — to string
- [ ] `num/top` — +Infinity
- [ ] `num/bottom` — -Infinity

### Boolean (10 kinds)
- [ ] `boolean/and` — logical AND
- [ ] `boolean/or` — logical OR
- [ ] `boolean/not` — logical NOT
- [ ] `boolean/eq` — equality
- [ ] `boolean/tt` — true constant
- [ ] `boolean/ff` — false constant
- [ ] `boolean/implies` — implication
- [ ] `boolean/show` — to string
- [ ] `boolean/top` — true
- [ ] `boolean/bottom` — false

### Str (17 kinds)
- [ ] `str/template` — template literal
- [ ] `str/concat` — concatenation
- [ ] `str/upper` — uppercase
- [ ] `str/lower` — lowercase
- [ ] `str/trim` — trim whitespace
- [ ] `str/slice` — substring
- [ ] `str/includes` — contains
- [ ] `str/startsWith` — prefix check
- [ ] `str/endsWith` — suffix check
- [ ] `str/split` — split
- [ ] `str/join` — join
- [ ] `str/replace` — replace
- [ ] `str/len` — length
- [ ] `str/eq` — equality
- [ ] `str/show` — identity (already string)
- [ ] `str/append` — semigroup append
- [ ] `str/mempty` — monoid empty

### Eq (1 kind)
- [ ] `eq/neq` — negated equality

### Ord (4 kinds)
- [ ] `ord/gt` — greater than
- [ ] `ord/gte` — greater or equal
- [ ] `ord/lt` — less than
- [ ] `ord/lte` — less or equal

### Error (5 kinds)
- [ ] `error/try` — try/catch
- [ ] `error/fail` — explicit failure
- [ ] `error/attempt` — attempt (returns result object)
- [ ] `error/guard` — guard condition
- [ ] `error/settle` — settle multiple

### Control (2 kinds)
- [ ] `control/each` — iteration
- [ ] `control/while` — conditional loop

### Fiber (4 kinds)
- [ ] `fiber/par_map` — parallel map
- [ ] `fiber/race` — race
- [ ] `fiber/timeout` — timeout with fallback
- [ ] `fiber/retry` — retry with backoff

### ST (4 kinds)
- [ ] `st/let` — declare mutable ref
- [ ] `st/get` — read ref (volatile)
- [ ] `st/set` — write ref
- [ ] `st/push` — push to ref

**Total: 74+ node kinds, each with interpreter handler + fold() test.**
