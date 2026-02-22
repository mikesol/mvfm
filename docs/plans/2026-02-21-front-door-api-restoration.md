# Front-Door API Restoration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restore the doc-facing API (`mvfm`, `fold`, `defaults`, `injectInput`, `prelude`) so every doc example works, with `fold` replacing `foldAST`.

**Architecture:** Thin wrapper (~150 lines) in `src/api.ts`. The CExpr→NExpr pipeline already exists (`elaborate.ts`). The fold engine already works. We just need to put the builder-callback pattern, input injection, and arg-order convention on top.

**Tech Stack:** TypeScript, vitest, existing CExpr/NExpr/fold/elaborate engine.

---

## What Already Works

The existing pipeline is complete:

```
CExpr (proxy tree) → app(cexpr)/createApp → NExpr (adjacency map) → fold(nexpr, interp) → result
```

Proven by `full-pipeline.test.ts`:
```ts
const $ = mvfmU(numPluginU, strPluginU, boolPluginU);
const prog = app($.mul($.add(2, 3), 4));
expect(await fold(prog, defaults(stdPlugins))).toBe(20);
```

CExpr construction uses Proxy for accessor chains. `elaborate()` walks CExpr trees, resolves traits, lifts primitives, and produces flat adjacency maps. `fold()` runs the trampoline. `defaults()` merges interpreters.

## What's Missing (the actual front door)

1. `mvfm(...plugins)` returning `app(schema, ($) => expr)` with `$.input`, `$.begin`, `$.cond`
2. `fold(interp, prog)` — flipped arg order from internal `fold(prog, interp)`
3. `defaults(app)` — taking app instance instead of plugin array
4. `injectInput(prog, data)` — replacing `core/input` nodes with values
5. `prelude` — const array of standard plugins
6. Core node kinds: `core/input`, `core/begin`, `core/cond`, `core/record`, `core/tuple`
7. Missing prelude ops (div, mod, concat, upper, etc.) with interpreters
8. Kill U suffix, delete plugin-simple.ts

---

## Task 0: Write everything-everywhere-all-at-once test (STOP POINT)

**Files:**
- Create: `packages/core/tests/everything-everywhere-all-at-once.test.ts`

**Purpose:** This test IS the specification. It defines the exact API contract before any implementation begins. It will NOT compile — that's intentional. Every subsequent task exists to make this test pass.

**Status:** DONE — written at `packages/core/tests/everything-everywhere-all-at-once.test.ts`

**What it exercises:**
- Front-door API: `mvfm`, `fold`, `defaults`, `injectInput`, `prelude`
- st plugin: `$.let`, `.get()`, `.set()`, `.push()`
- error plugin: `$.try().catch()`, `$.fail()`, `$.guard()`
- control plugin: `$.each()`, `$.while().body()`
- Arithmetic: add, sub, mul, div, mod, neg, abs, floor, min, max
- Strings: concat, upper, trim, replace, startsWith, len, show
- Booleans: and, or, not
- Ordering: gt, lt, gte
- Eq/Neq: including nested trait dispatch `$.eq($.eq(1,2), $.eq(3,4))`
- Core: `$.cond().t().f()`, `$.begin()`, `$.input.x` proxy chains
- Auto-lift: records, tuples, raw JS values → core/literal
- Deeply nested let bindings: `$.let({ y: a, deep: { inner: expr } })`
- Proxy access chains: `cell.get().deep.inner`
- Record/tuple auto-lift on return
- Error recovery across cond branches with st side effects
- Computes **42**

Three tests total:
1. **"the answer is 42"** — the mega sadistic test (11 phases, every feature)
2. **"record and tuple auto-lift return"** — exercises auto-lift at return position
3. **"error recovery across branches"** — exercises error+st+cond interaction with two inputs

**⚠️ STOP HERE for user review before proceeding to Task 1.**

---

## Task 1: Delete simple plugin system, rename U exports

**Files:**
- Delete: `packages/core/src/plugin-simple.ts`
- Modify: `packages/core/src/std-plugins.ts` — `numPluginU` → `numPlugin`, etc.
- Modify: `packages/core/src/index.ts` — remove plugin-simple export
- Modify: all files referencing old names (tests, elaborate.ts)

**Steps:**
1. Delete `plugin-simple.ts`
2. Rename `numPluginU`→`numPlugin`, `strPluginU`→`strPlugin`, `boolPluginU`→`boolPlugin` in `std-plugins.ts`
3. Remove `export * from "./plugin-simple"` from `index.ts`
4. Find-and-replace across all test files and source files
5. `npm run build && npm test` — should pass (pure renames)
6. Commit: `refactor(core): remove simple plugin system, kill U suffix`

---

## Task 2: Expand prelude ops — num

**Files:**
- Modify: `packages/core/src/std-plugins.ts`
- Modify: `packages/core/src/constructors.ts`
- Create: `packages/core/tests/prelude-num.test.ts`

Add to numPlugin: `num/div`, `num/mod`, `num/neg`, `num/abs`, `num/floor`, `num/ceil`, `num/round`, `num/min`, `num/max`, `num/show`, `num/compare`, `num/zero`, `num/one`, `num/top`, `num/bottom`.

Each needs: kind spec in `kinds`, handler in `defaultInterpreter()`, entry in `nodeKinds`.

Add constructors to `constructors.ts`: `div`, `mod`, `neg`, `abs`, `floor`, `ceil`, `round`, `min`, `max`.

All trivial — one-liner JS operations. Test each with raw adjacency maps.

Commit: `feat(core): expand num plugin with full prelude surface`

---

## Task 3: Expand prelude ops — str

Same pattern. Add: `str/concat`, `str/upper`, `str/lower`, `str/trim`, `str/slice`, `str/includes`, `str/startsWith`, `str/endsWith`, `str/split`, `str/join`, `str/replace`, `str/len`, `str/show`, `str/append`, `str/mempty`.

Commit: `feat(core): expand str plugin with full prelude surface`

---

## Task 4: Expand prelude ops — bool/ord/eq extras

Add: `bool/and`, `bool/or`, `bool/not`, `bool/implies`, `bool/show`, `bool/tt`, `bool/ff`, `num/gt`, `num/gte`, `num/lte`, `str/gt`, `str/gte`, `str/lt`, `str/lte`, `num/neq`, `str/neq`, `bool/neq`, `num/compare`, `str/compare`.

Expand ordPlugin and boolPlugin (currently `boolPlugin` is just literal+eq).

Commit: `feat(core): expand bool/ord plugins with full prelude surface`

---

## Task 5: Front-door API

**Files:**
- Create: `packages/core/src/api.ts` (~150 lines)
- Modify: `packages/core/src/index.ts`
- Create: `packages/core/tests/api.test.ts`

### `api.ts` contents:

**`prelude`**: const array of `[numPlugin, strPlugin, boolPlugin, ordPlugin]` (and future show/semigroup/etc once they exist as separate plugins — for now, their node kinds live on the existing plugins).

**`mvfm(...plugins)`**:
- Flattens plugin inputs (arrays, factories)
- Returns a callable `define(schema?, fn)` with `.plugins` property
- `define` builds a `$` object:
  - `$.input`: a CExpr with kind `"core/input"` (proxy-wrapped, so `$.input.x` creates `core/access` chains — this already works via the existing CExpr proxy!)
  - `$.begin(...exprs)`: creates a CExpr with kind `"core/begin"`, args = exprs
  - `$.cond(pred)`: returns `{t(then){return {f(else){return cexpr}}}, f(else){...}}`
  - All plugin ctors merged from `plugin.ctors`
  - Trait constructors (`eq`, `neq`, `gt`, `show`, etc.) from plugin trait definitions
- Calls `fn($)`, auto-lifts object returns to `core/record`, array returns to `core/tuple`
- Returns `Program = { __nexpr: createApp(...plugins)(result), __plugins: plugins, __inputSchema: schema }`

**`injectInput(prog, data)`**:
- Walks `prog.__nexpr.__adj`, finds `core/input` nodes, replaces their `out` with the data object
- Returns new Program with modified NExpr

**`fold(interp, prog)`** (public):
- Calls internal `foldEngine(prog.__nexpr, interp)` (the existing fold, possibly re-exported under a different name)

**`defaults(app, overrides?)`** (public):
- Takes `app` (has `.plugins`), calls existing `defaults(app.plugins, overrides)` plus adds `coreInterpreter`

**`coreInterpreter`**: handlers for `core/input`, `core/begin`, `core/cond`, `core/record`, `core/tuple`, `core/literal`, `core/prop_access`/`core/access`, `core/program`. All use positional yield against the adjacency map — these are the same handlers already proven in `kitchen-sink-helpers.ts` and `fold-pipeline.test.ts`.

### Key insight: CExpr proxy already does 90% of the work

`$.input.x` → `makeCExpr("core/input", []).x` → CExpr proxy creates `core/access` node → `elaborate()` flattens it to adjacency map entries. **No new flattening code needed.**

`$.begin(a, b, c)` → `makeCExpr("core/begin", [a, b, c])` → elaborate walks the args.

`$.cond(p).t(x).f(y)` → `makeCExpr("core/cond", [p, x, y])` → elaborate walks them.

Object return `{a: expr, b: expr}` → detect at build time, wrap as `makeCExpr("core/record", [{a: expr, b: expr}])`.

The `elaborate()` function already handles CExpr trees with trait resolution, lifting, structural shapes, and access chains. We're just adding new CExpr kinds and their elaborate/interpret support.

### Tests:

```ts
test("basic: add(x, 10) → 42", async () => {
  const app = mvfm(prelude);
  const prog = app({ x: "number" }, ($) => $.add($.input.x, 10));
  expect(await fold(defaults(app), injectInput(prog, { x: 32 }))).toBe(42);
});
```

Plus: cond, begin, record, tuple, eq, string ops.

Commit: `feat(core): restore front-door API — mvfm, fold, defaults, injectInput, prelude`

---

## Task 6: Clean exports, delete compat cruft

Curate `index.ts`: public API at top, plugins, types, advanced/internal as escape hatch. Delete or gut `compat.ts`. Verify external plugins still compile.

Commit: `refactor(core): curate public exports, remove compat shims`

---

## Task 7: Verify doc examples

Take 5-6 doc examples verbatim, wrap as tests, replace `foldAST` → `fold`. Verify they pass.

Commit: `test(core): verify doc examples work with restored API`

---

## Dependency Graph

```
0 (everything test — WRITTEN, won't compile yet)
│
1 (rename, delete simple)
├── 2 (num ops)    ─┐
├── 3 (str ops)    ─┼── 5 (front-door API) ── 6 (exports) ── 7 (doc examples)
├── 4 (bool/ord)   ─┘

Goal: make Task 0's test pass.
```

Task 0 is already done. Tasks 2, 3, 4 can run in parallel. Task 5 needs the ops. Tasks 6-7 are sequential. The everything-everywhere test serves as the integration gate — when it passes, the front door is back on.
