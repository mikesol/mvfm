# DAG Lift Architecture — Agent Spec

> **For the implementing agent:** You are working in the worktree at `/home/mikesol/Documents/GitHub/ilo/ilo/.worktrees/issue-290/`. All file paths in this spec are relative to that root. Read every file in `packages/core/src/dag/` first. Understand the current CExpr/NExpr/fold pipeline. Then read this spec. It will change how you think about where type checking belongs.

## The Insight

In TypeScript, you can't go from type to term (`mempty :: String` doesn't exist). So we need runtime values at construction time. But here's the key: **the runtime values during construction only matter insofar as they carry enough information for fold to work.** The types at construction time are irrelevant — they're checked later.

This means:

1. **CExpr construction is maximally permissive.** `add("foo", true)` builds a node. No type errors. CExpr is just accumulating graph structure.

2. **`app()` is the gate.** When CExpr → NExpr normalization happens, `app()` does two jobs at the type level:
   - **Validates** — rejects `add("foo", true)` because `num/add` expects numeric children
   - **Lifts** — raw `3` becomes `number`, `CExpr<number>` becomes `number`, `{a: 3, b: CExpr<number>}` becomes `{a: number, b: number}`

3. **Fold does runtime lifting.** When the interpreter encounters raw values during traversal, it lifts them (wraps in core/literal, core/tuple, core/record as needed). A lift boundary prevents re-lifting already-lifted subterms.

The error surfaces on `app(...)`, not at individual call sites. The error message can be precise about WHERE in the graph the problem is.

## What This Changes

### CExpr (construction time) — becomes permissive

Current: builders are precisely typed. `numAdd` only accepts `CExpr<unknown, LId, LA>`. Raw values rejected at the call site.

New: builders accept **anything** — parameter types are `unknown`. There is no `Liftable` constraint type. If a JS value exists, you can pass it to a builder. Every value is liftable: primitives are blobs, arrays decompose, records decompose, CExprs pass through, class instances are blobs. There is nothing that cannot be lifted.

At the term level, builders call `lift()` internally to normalize raw values into CExpr nodes before building the DAG node. This is purely for runtime — the type-level CExpr can be loose.

The builder factories (`binaryOf`, `unaryOf`, etc.) return functions that accept `unknown` arguments and produce CExpr with:
- Correct `O` output type (precise — declared by the factory, not inferred from inputs)
- Opaque `Id` and `Adj` (`string` and `unknown`) — no more precise template literal IDs at the builder level

### Lifting — decomposed into DAG nodes

When `lift()` encounters a value at runtime, it decomposes it:

| Input | Node kind | `entry.out` | Children |
|-------|-----------|-------------|----------|
| Primitive (number, string, boolean, null, undefined) | `core/literal` | the value | none |
| Opaque blob (Date, HTMLCanvas, class instance, function) | `core/literal` | the value | none |
| CExpr | pass through | — | — |
| Array / tuple | `core/tuple` | undefined | `lift(element)` for each |
| Record (plain object, not CExpr) | `core/record` | `string[]` (sorted keys) | `lift(value)` for each key |

CExpr detection at runtime: check for `__id` and `__adj` properties.

Record key ordering is deterministic (sorted) for content-addressing.

For non-serializable blobs, use a WeakMap-backed counter for the ID — same object reference = same ID within a session.

### app() / NExpr (normalization time) — does validation + type-level lifting

Current `app()`: walks the CExpr graph via type-level DFS (ProcessNode/ProcessChildren), assigns sequential IDs, produces NExpr with precise types.

New `app()`: does the same DFS but additionally:

1. **Validates node constraints.** Each node kind declares what children it accepts. During the type-level traversal, `app()` checks that children match. If not, the result type is `never` (or a branded error type with a descriptive message).

2. **Lifts types.** Raw values embedded in the graph get their types lifted:
   - `core/literal` with `out: 3` → output type `number` (or `3` if const)
   - `core/tuple` with children `[CExpr<number>, CExpr<string>]` → output type `[number, string]`
   - `core/record` with keys `["a", "b"]` and children `[CExpr<number>, CExpr<string>]` → output type `{a: number, b: string}`

3. **Produces NExpr** with the lifted output type as `O`.

The `Lifted<T>` type (recursive unwrapping of CExpr) is used during normalization, not at builder call sites.

### fold() (runtime) — does runtime lifting

The fold interpreter already works with `RuntimeEntry`. The change is:

1. **`core/record` handler** (new):
   ```ts
   async function* (entry) {
     const keys = entry.out as string[];
     const result: Record<string, unknown> = {};
     for (let i = 0; i < keys.length; i++) {
       result[keys[i]] = yield i;
     }
     return result;
   }
   ```

2. **`core/tuple` handler** already exists — yields all children, returns array.

3. **`core/literal` handler** already exists — returns `entry.out`.

4. **Lift boundary:** When fold encounters a subtree that's already been lifted (all nodes are core/literal, core/tuple, core/record), it can skip re-lifting. This is an optimization, not a correctness requirement. Implement it if performance matters; skip it initially.

## Node Kind Validation Rules

Each node kind needs a type-level declaration of what children it accepts. This is how `app()` validates the graph. Examples:

```
num/add:     [number, number] → number
num/neg:     [number] → number
num/eq:      [number, number] → boolean
str/concat:  [...string[]] → string
str/slice:   [string, number, number] → string
core/cond:   [boolean, T, T] → T
core/tuple:  [...any[]] → tuple of children types
core/record: [...any[]] → record (keys from entry.out)
core/literal: [] → typeof entry.out
```

The implementing agent should define these constraints as a type-level registry that `app()` consults during traversal.

## What Files Need Rewriting

All files are in `packages/core/src/dag/`.

### Must rewrite

- **`cexpr-builders.ts`** — builders accept `unknown`, call `lift()` internally, return `CExpr<O, string, unknown>` (opaque Id/Adj). Add `lift()` function here.
- **`00-expr.ts`** — CExpr may need adjustments. NExpr's type-level representation needs to carry lifted output types. Add `Lifted<T>` type.
- **`04-normalize.ts`** — `app()` does validation + lifting during ProcessNode. Add node kind constraint registry. Error reporting via branded types.
- **`core-interpreter.ts`** — add `core/record` handler.

### May need adjustments

- **`02-build.ts`** — the old `numLit`, `add`, `mul` may be superseded by cexpr-builders. Decide: keep as legacy examples, or rewrite to use new builders.
- **`03-traits.ts`** and sub-modules — trait dispatch (`composeEq`, `mvfm`) may need updates if CExpr's type parameters change.
- **`05-predicates.ts` through `15-pipe.ts`** — DagQL operations work on NExpr. If NExpr's type shape changes, these need updates.
- **`fold.ts`** — likely minimal changes. The trampoline doesn't care about types.

### Must NOT rewrite

- **`01-increment.ts`** — pure utility, no changes needed.

## Testing Requirements

1. **Permissive construction tests:** `add(3, 4)`, `add("foo", true)`, `someOp({a: {b: [3, someCExpr]}})` all construct CExpr without errors.

2. **app() validation tests:**
   - `app(add(numLit(3), numLit(4)))` → valid NExpr with output type `number`
   - `app(add(3, 4))` → valid NExpr with output type `number` (raw values lifted)
   - `app(add("foo", true))` → type error (compile-time rejection via `never` or error brand)
   - `app(someOp({a: 3, b: someCExpr}))` → valid NExpr with lifted record type

3. **Lifted type precision tests:**
   - `Lifted<number>` = `number`
   - `Lifted<CExpr<number, any, any>>` = `number`
   - `Lifted<[3, CExpr<string, any, any>]>` = `[3, string]`
   - `Lifted<{a: {b: CExpr<number, any, any>}}>` = `{a: {b: number}}`

4. **fold() integration tests:** Build with raw values → app() → fold() → correct result.

5. **DagQL tests:** Build → app() → selectWhere/replaceWhere → fold() — verify DagQL still works with the new NExpr shape.

6. **Negative type tests:** `@ts-expect-error` for invalid compositions caught by app().

## Success Criteria

- `npm run build && npm run check && npm test` passes
- All existing fold tests still pass (backward compatible runtime)
- New tests cover: permissive construction, app() validation, type lifting, fold integration
- ≥20 `@ts-expect-error` negative assertions for app() validation
- ≥20 positive type assertions for lifted types
- No `as any` in user-facing code (internal factory implementations may use it at makeCExpr return)
- Files stay under 300 lines

## What This Spec Does NOT Cover

- Plugin interpreters (num, str, boolean, etc.) — these are downstream of the dag/ rewrite
- Typeclass dispatch plugins (eq, ord, show) — these layer on top
- Barrel exports / index.ts cleanup — done after dag/ stabilizes
- The old tree-based code deletion — separate task
