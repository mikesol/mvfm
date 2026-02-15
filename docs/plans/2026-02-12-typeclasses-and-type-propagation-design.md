# Typeclasses and Type Propagation Design

**Date:** 2026-02-12
**Issue:** #17
**Status:** Approved design, pending implementation

## Problem

`$.eq` lives in core as polymorphic equality with no type constraints. This is a symptom of a deeper issue: the DSL has no type propagation. `Expr<T>` carries a phantom type `T`, but the proxy's `[key: string]: any` index signature erases it at every property access. Without flowing types, typeclass dispatch is impossible.

Additionally, `$.input` is `Expr<Record<string, unknown>>` — completely untyped. Users can access any property without declaring their schema.

## Design

### Phase 1: Typed inputs

The `define` function gains a type parameter `I` for the input schema, defaulting to `never`:

```ts
const app = mvfm(num, str)

// I = never (default) — $.input is untouchable
const prog1 = app(($) => $.add(1, 2))

// I = { name: string, age: number } — $.input is typed
const prog2 = app<{ name: string, age: number }>(($) => {
  const greeting = $.str`Hello ${$.input.name}`
  const nextAge = $.add($.input.age, 1)
  return { greeting, nextAge }
})
```

- `CoreDollar` becomes `CoreDollar<I>` where `input: Expr<I>`
- Default `I = never` means `$.input` property access is a type error unless schema is declared
- Backwards compatible: programs not using `$.input` don't need to change

### Phase 2: Type-preserving proxies

Remove the `[key: string]: any` index signature from `Expr<T>`. Replace with mapped types:

```ts
type Expr<T> = {
  readonly [MVFM]: true;
  readonly __node: ASTNode;
} & (
  T extends Record<string, unknown>
    ? { readonly [K in keyof T]: Expr<T[K]> }
    : {}
)
```

Effects:
- `Expr<{ name: string }>` has `.name: Expr<string>`
- `Expr<string>` is a leaf — no extra properties
- `Expr<number[]>` supports typed array methods
- `$.add($.input.name, 1)` is a type error when `name: string`

Hard parts to spike:
- Array methods (`.map`, `.filter`, `.reduce`) need careful typing
- Numeric indexing on `Expr<T[]>`
- `Expr<unknown>` as explicit escape hatch for untyped data

Runtime behavior is unchanged — proxies still intercept everything and build AST nodes.

### Phase 3: Typeclass dispatch via overloads

With types flowing through the system, `$.eq` can dispatch at compile time:

- Plugins contribute overloads to shared trait methods
- TypeScript's overload resolution picks the right one based on argument types
- The matched overload determines which AST node kind to emit
- No runtime type inspection needed

Example (conceptual):
```ts
// num plugin contributes:
eq(a: Expr<number> | number, b: Expr<number> | number): Expr<boolean>  // emits num/eq

// str plugin contributes:
eq(a: Expr<string> | string, b: Expr<string> | string): Expr<boolean>  // emits str/eq
```

If overload-based dispatch proves unworkable (DX issues, TypeScript limitations), fall back to runtime node-kind inspection or explicit type tags.

### Negative type tests

Use `@ts-expect-error` and vitest's built-in `expectTypeOf` to prove the type system rejects invalid programs:

```ts
// @ts-expect-error — booleans are not numbers
$.add(true, "foo")

// @ts-expect-error — no input schema declared
app(($) => $.input.name)

expectTypeOf($.add(1, 2)).toEqualTypeOf<Expr<number>>()
```

### Future: Zod integration

A Zod plugin for narrowing `Expr<unknown>` via schema validation. Not in scope for this design. Example direction: `$.parse(userSchema, $.input.data)` narrows `Expr<unknown>` to `Expr<User>`.

## Implementation order

1. **Spike phases 1+2** — typed inputs and type-preserving proxies with negative type tests
2. **Phase 3** — typeclass dispatch, starting with `$.eq`, once the type foundation is proven
3. **Move `$.eq` out of core** — once dispatch works, `eq` becomes a trait provided by plugins
4. **Broader typeclasses** — `Eq`, `Ord` (subsumes num comparisons), `Semiring` (subsumes num arithmetic), `HeytingAlgebra` (subsumes boolean ops)

## Risks

- Mapped types on `Expr<T>` may cause TypeScript performance issues on deeply nested types
- Proxy runtime behavior must remain unchanged while types become stricter
- Overload-based dispatch (phase 3) may have poor error messages or unexpected resolution behavior
- Array method typing on `Expr<T[]>` is notoriously tricky in TypeScript

These risks are why this starts as a spike.

## Affected VISION.md sections

- §3 (Core primitives) — `$.eq` will eventually leave core
- §5 (Plugins) — new structural role for trait-providing plugins

## Downstream impact

- All existing test files may need type annotations on `app()` calls
- Plugin authoring guide needs updating for trait registration
- `$.input` usage patterns change (must declare schema)
