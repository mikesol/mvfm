# Enforce ctor-kind consistency at the Plugin type level

**Issue**: #300
**Date**: 2026-02-22
**Status**: Approved

## Problem

Plugin types have two independent sources of truth for type information:
1. Constructor types (hand-written interfaces like `RedisMethods`) that independently declare input/output types
2. KindSpec — the authoritative type metadata used by `app()`/`AppResult` for type-level validation

These can disagree silently. External plugins enforce types at construction time (wrong level) and erase kind strings from CExpr return types, making `app()` unable to validate them.

## Design

### 1. Add ExtractKinds<T> and enforce on Plugin

Add a recursive type to `packages/core/src/plugin.ts` that walks ctor types and collects all CExpr kind strings:

```typescript
type ExtractKinds<T> =
  T extends CExpr<any, infer K extends string, any>
    ? K
    : T extends (...args: any[]) => infer R
      ? ExtractKinds<R>
      : T extends Record<string, unknown>
        ? { [P in keyof T]: ExtractKinds<T[P]> }[keyof T]
        : never;
```

Modify the Plugin interface to enforce ctor-kind consistency:

```typescript
interface Plugin<
  Name extends string = string,
  Ctors = any,
  Kinds extends Record<string, KindSpec<any, any>> = any,
  Traits extends Record<string, TraitDef<any, any>> = any,
  Lifts extends Record<string, string> = any,
> {
  readonly name: Name;
  readonly ctors: [ExtractKinds<Ctors>] extends [keyof Kinds] ? Ctors : never;
  readonly kinds: Kinds;
  readonly traits: Traits;
  readonly lifts: Lifts;
  readonly defaultInterpreter?: () => Interpreter;
  readonly shapes?: Record<string, unknown>;
}
```

The Ctors type parameter is relaxed from `Record<string, (...args: any[]) => any>` to bare `any` — ExtractKinds is the real constraint, not the parameter bound.

### 2. Make all external plugin constructors permissive

External plugins currently enforce types at construction time:

```typescript
// Before
get(key: CExpr<string> | string): CExpr<string | null>
```

They must adopt the core pattern — permissive generics with kind strings in return types:

```typescript
// After
get<A>(key: A): CExpr<string | null, "redis/get", [A]>
```

This ensures:
- ExtractKinds can see the kind string in the return type
- `app()` can validate arguments via KindSpec
- Type checking happens at `app()` time, not construction time

### 3. Inline kinds as const

Remove `buildKinds()` functions from external plugins. Put kinds directly in the plugin object literal as `as const`, matching the core pattern (numPlugin, strPlugin, etc.).

### 4. Delete hand-written method interfaces

Remove `RedisMethods`, `OpenAIMethods`, etc. These become redundant — ctor signatures are typed by their function definitions, and ExtractKinds validates against kinds.

### 5. liftArg stays

External plugins that recursively lift plain objects into structural nodes (redis/record, openai/record) keep that runtime pattern. It's invisible to the type system and doesn't affect the constraint.

## What doesn't change

- **MergeCtors/DollarSign**: Still merge ctor types from plugins. Works because the conditional resolves for well-formed plugins.
- **Runtime map builders**: Accept `readonly Plugin[]` at value level, unaffected.
- **RegistryOf<P>**: Gets better type flow from inline const kinds.
- **User-facing API**: `$.redis.get(...)`, `$.add(1, 2)` etc. unchanged.
- **Runtime behavior**: All changes are type-level. Tests need signature updates, not behavioral changes.

## Known gap

`st/let` is created as a side effect (pushed to effects array, not returned from ctor). The type system can't see side effects. This is a narrow, documented exception.

## Affected plugins (14 external)

anthropic, cloudflare-kv, console, fal, fetch, openai, pino, postgres, redis, resend, s3, slack, stripe, twilio
