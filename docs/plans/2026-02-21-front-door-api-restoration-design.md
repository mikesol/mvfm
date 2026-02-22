# Front-Door API Restoration

**Date:** 2026-02-21
**Branch:** issue-291
**Status:** Design approved

## Problem

The issue-291 rebuild replaced the core engine but never restored the user-facing API. The docs show a clean three-step pattern (`mvfm → app → fold`) that doesn't work on this branch. The internal engine (CExpr, NExpr, fold trampoline, DAG ops, elaboration, proxy accessors) is solid. What's missing is the surface layer.

## Goal

Restore the exact doc-facing API with one deliberate change: `fold` replaces `foldAST` as the public name.

### Target API (from docs)

```ts
const app = mvfm(prelude, console_);
const prog = app({ x: "number", label: "string" }, ($) => {
  const doubled = $.mul($.input.x, 2);
  return { value: doubled, tag: $.input.label };
});
await fold(defaults(app), injectInput(prog, { x: 5, label: "result" }));
```

### What exists today

- `mvfmU(...plugins)` → `$` bag with ctors (U suffix, no schema/builder callback)
- `app(cexpr)` → NExpr (single-arg, no input schema)
- `fold(nexpr, interp)` → result (low-level, two signatures)
- `defaults(pluginArray)` → interpreter (takes plugin list, not app)
- `foldAST()` → throws at runtime
- No `injectInput`, no `$.input`, no `$.begin`, no `$.cond` builder, no `prelude`
- `numPluginU`/`strPluginU`/`boolPluginU` coexist with `numPlugin`/`strPlugin`/`boolPlugin`

## Design

### Approach: Thin wrapper layer

New file `src/api.ts` implements the doc-facing API as wrappers over the existing engine. No changes to fold.ts, elaborate.ts, or dagql internals.

### API surface to restore

| Function | Signature | Notes |
|----------|-----------|-------|
| `mvfm` | `(...plugins) → app` | Returns callable with `.plugins` property |
| `app()` | `(schema?, ($) => expr) → Program` | Two overloads: with/without schema |
| `fold` | `(interp, prog, state?) → Promise<T>` | Public name, wraps internal fold |
| `defaults` | `(app, overrides?) → Interpreter` | Takes app instance, not plugin list |
| `injectInput` | `(prog, data) → Program` | Attaches input values to program |
| `prelude` | const array of standard plugins | All built-in plugins bundled |

### `$` object shape

Core methods (always present):
- `$.input` — proxy for accessing declared inputs
- `$.begin(...exprs)` — sequential composition, returns last
- `$.cond(pred).t(then).f(else)` — conditional branching (either order)

Plugin methods (merged from plugin ctors):
- `$.add`, `$.mul`, `$.sub`, `$.div`, `$.mod`, `$.neg`, `$.abs`, `$.floor`, `$.ceil`, `$.round`, `$.min`, `$.max`
- `$.concat`, `$.upper`, `$.lower`, `$.trim`, `$.slice`, `$.includes`, `$.startsWith`, `$.endsWith`, `$.split`, `$.join`, `$.replace`, `$.len`, `$.str` (template)
- `$.and`, `$.or`, `$.not`, `$.implies`
- `$.eq`, `$.neq`
- `$.gt`, `$.gte`, `$.lt`, `$.lte`, `$.compare`
- `$.show`

### Naming cleanup

- `numPluginU` → `numPlugin` (delete old simple `numPlugin`)
- `strPluginU` → `strPlugin` (delete old simple `strPlugin`)
- `boolPluginU` → `boolPlugin` (delete old simple `boolPlugin`)
- `mvfmU` → internal only (or removed entirely)
- Delete `plugin-simple.ts` entirely
- `foldAST` compat shim → re-point to new `fold` (or keep throwing with better message)

### Full prelude ops to implement

**num** (missing: div, mod, neg, abs, floor, ceil, round, min, max, show, compare, zero, one, top, bottom):
All are unary or binary ops with trivial interpreters.

**str** (missing: concat, upper, lower, trim, slice, includes, startsWith, endsWith, split, join, replace, len, template, show, append, mempty):
String operations, all straightforward.

**boolean** (missing: and, or, not, implies, show, top, bottom, ff, tt):
Logical operations.

**ord** (missing: gt, gte, lte, compare — lt exists):
Comparison operations via trait dispatch.

**eq** (missing: neq):
Negated equality.

**show**: Type-dispatched toString.

### Program type

```ts
interface Program {
  __nexpr: NExpr;        // The elaborated expression
  __plugins: Plugin[];   // Plugin list for defaults()
  __inputSchema?: Record<string, string>;  // Schema if declared
}
```

Thin wrapper over NExpr with metadata. `injectInput` modifies the adjacency map to replace `core/input` nodes with literal nodes carrying the injected values.

### Internal fold rename

The current `fold()` in `fold.ts` stays as the internal engine. The public `fold()` in `api.ts` wraps it with the `(interp, prog)` signature from the docs. The internal version can be re-exported as `foldRaw` or similar for advanced use, or just not exported publicly.

### Export strategy

`index.ts` exports:
- **Public API:** `mvfm`, `fold`, `defaults`, `injectInput`, `prelude`
- **Types:** `Program`, `Plugin`, `Interpreter`
- **Plugins:** `numPlugin`, `strPlugin`, `boolPlugin`, `ordPlugin` (no U suffix)
- **Advanced/internal:** `CExpr`, `NExpr`, `createApp`, `makeCExpr`, DAG ops — available but not the front door

### Everything-everywhere-all-at-once test

Single test file using exclusively the doc-facing API. Exercises: input injection, arithmetic, string ops, boolean logic, conditionals, begin/sequencing, records, tuples, trait dispatch (eq, ord, show), and asserts on the final result. Uses the pattern:

```ts
const app = mvfm(prelude);
const prog = app({ ... }, ($) => { ... });
expect(await fold(defaults(app), injectInput(prog, { ... }))).toBe(42);
```

### Deliberate API change from old

| Old | New | Reason |
|-----|-----|--------|
| `foldAST` | `fold` | Nobody wants to type AST |

No other changes to the user-facing API shape.
