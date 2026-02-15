# Prelude Typeclass Expansion: Show, Semigroup, Monoid, Bounded

**Issue:** #29
**Date:** 2026-02-12
**Status:** Approved design
**Reference:** [PureScript prelude](https://github.com/purescript/purescript-prelude) — verified against source

## Overview

Add four typeclasses from the PureScript prelude, each as its own plugin. Following the same pattern established in #20: data plugins register trait implementations, trait plugins dispatch via shared type inference.

| Typeclass | Primitives | Identity | Instances |
|-----------|-----------|----------|-----------|
| **Show** | `show` | — | number, boolean, string |
| **Semigroup** | `append` | — | string |
| **Monoid** | `mempty` | — | string (superclass: Semigroup) |
| **Bounded** | `top`, `bottom` | — | number, boolean (superclass: Ord) |

**Functor deferred** — no container types exist yet. Gets its own issue when arrays/Option/Result land.

## Design Decisions

1. **Semigroup: string only.** Numbers have two natural semigroup operations (add/mul) with no canonical choice. Semiring handles numeric combination. Matching PureScript.
2. **Show: string coercion.** `show(42)` → `"42"`, `show(true)` → `"true"`, `show("hello")` → `"hello"` (pass-through). Matches `String()` in JS.
3. **Monoid: minimal.** Just `mempty`, no `guard`/`power`. Add later if needed.
4. **Parameterless operations (mempty, top, bottom): structural only.** Registered in traits for completeness but not exposed as user-facing methods. Matches Semiring's `zero`/`one` pattern — type inference requires arguments.

## Core Changes

### TraitImpl slots (src/core.ts)

Expand `PluginDefinition.traits`:

```ts
traits?: {
  eq?: TraitImpl;
  ord?: TraitImpl;
  semiring?: TraitImpl;
  heytingAlgebra?: TraitImpl;
  show?: TraitImpl;
  semigroup?: TraitImpl;
  monoid?: TraitImpl;
  bounded?: TraitImpl;
};
```

## Data Plugin Changes

### str plugin

**Trait registrations (additions):**
```ts
traits: {
  eq: { type: "string", nodeKinds: { eq: "str/eq" } },
  show: { type: "string", nodeKinds: { show: "str/show" } },
  semigroup: { type: "string", nodeKinds: { append: "str/append" } },
  monoid: { type: "string", nodeKinds: { mempty: "str/mempty" } },
}
```

**New node kinds:** `str/show`, `str/append`, `str/mempty`

**Interpreter:**
- `str/show` → pass through (strings show as themselves)
- `str/append` → `left + right` (string concatenation)
- `str/mempty` → `""`

### num plugin

**Trait registrations (additions):**
```ts
traits: {
  // existing: eq, ord, semiring
  show: { type: "number", nodeKinds: { show: "num/show" } },
  bounded: { type: "number", nodeKinds: { top: "num/top", bottom: "num/bottom" } },
}
```

**New node kinds:** `num/show`, `num/top`, `num/bottom`

**Interpreter:**
- `num/show` → `String(value)`
- `num/top` → `Infinity`
- `num/bottom` → `-Infinity`

### boolean plugin

**Trait registrations (additions):**
```ts
traits: {
  // existing: eq, heytingAlgebra
  show: { type: "boolean", nodeKinds: { show: "boolean/show" } },
  bounded: { type: "boolean", nodeKinds: { top: "boolean/top", bottom: "boolean/bottom" } },
}
```

**New node kinds:** `boolean/show`, `boolean/top`, `boolean/bottom`

**Interpreter:**
- `boolean/show` → `String(value)` (produces `"true"`/`"false"`)
- `boolean/top` → `true`
- `boolean/bottom` → `false`

## Trait Plugins

All follow the discovery/dispatch pattern from #20: collect impls via `ctx.plugins`, infer types, dispatch to correct node kind. Single-impl fallback when type inference fails but only one provider exists.

### show plugin (new: src/plugins/show/index.ts)

- **nodeKinds:** `[]` — pure dispatcher
- **Methods:** `show(a)` with overloads for number/string/boolean → returns `Expr<string>`
- **Dispatch:** unary — infers type from single argument, emits `impl.nodeKinds.show`
- **No interpreter needed** — data plugin interpreters handle the node kinds

### semigroup plugin (new: src/plugins/semigroup/index.ts)

- **nodeKinds:** `[]` — pure dispatcher
- **Methods:** `append(a, b)` with string overload → returns `Expr<string>`
- **Dispatch:** binary — infers type from arguments, emits `impl.nodeKinds.append`
- **No interpreter needed** — str interpreter handles `str/append`

### monoid plugin (new: src/plugins/monoid/index.ts)

- **nodeKinds:** `[]` — pure structural registration
- **No user-facing methods** — `mempty` is parameterless, type inference requires arguments
- **Exists for:** structural completeness, future derived operations
- **No interpreter needed**

### bounded plugin (new: src/plugins/bounded/index.ts)

- **nodeKinds:** `[]` — pure structural registration
- **No user-facing methods** — `top`/`bottom` are parameterless
- **Exists for:** structural completeness, future derived operations (clamp, between)
- **No interpreter needed**

## AST Node Shapes

### New nodes

```ts
// Show (unary)
{ kind: "num/show", operand: ASTNode }
{ kind: "str/show", operand: ASTNode }
{ kind: "boolean/show", operand: ASTNode }

// Semigroup (binary)
{ kind: "str/append", left: ASTNode, right: ASTNode }

// Monoid (structural only)
{ kind: "str/mempty" }

// Bounded (structural only)
{ kind: "num/top" }
{ kind: "num/bottom" }
{ kind: "boolean/top" }
{ kind: "boolean/bottom" }
```

## Test Plan

| Plugin | AST test | Interpreter test |
|--------|----------|------------------|
| show | Dispatch for num/str/bool, node shape | show(42) → "42", show(true) → "true", show("hi") → "hi" |
| semigroup | append dispatch, node shape | append("foo", "bar") → "foobar" |
| monoid | Trait declaration on str | — (structural only) |
| bounded | Trait declaration on num, boolean | — (structural only) |

Existing test updates:
- **str tests:** add trait assertion for semigroup, monoid, show
- **num tests:** add trait assertion for show, bounded
- **boolean tests:** add trait assertion for show, bounded

## Exports (src/index.ts)

```ts
export { show } from "./plugins/show";
export type { ShowMethods } from "./plugins/show";
export { semigroup } from "./plugins/semigroup";
export type { SemigroupMethods } from "./plugins/semigroup";
export { monoid } from "./plugins/monoid";
export { bounded } from "./plugins/bounded";
```

## Usage After

```ts
import { mvfm, num, str, boolean, show, semigroup } from "mvfm";

const app = mvfm(num, str, boolean, show, semigroup);

app({ x: "number", y: "string" }, ($) => {
  const label = $.show($.input.x);              // show → num/show → "42"
  const greeting = $.append($.input.y, label);  // semigroup → str/append
  return greeting;
});
```

## Not in Scope

- Functor (deferred — no container types)
- Monoid `guard`/`power` derived operations
- Semigroup for numbers (Semiring handles it)
- Bounded `clamp`/`between` derived operations
- New data type instances beyond number/boolean/string
