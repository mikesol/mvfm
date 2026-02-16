# Enforce Handler Node Types in Interpreter/CompleteInterpreter

**Issue:** #197
**Date:** 2026-02-16
**Status:** Design approved

## Problem

`Interpreter` and `CompleteInterpreter<K>` use `(node: any)` as the handler signature. `typedFoldAST` checks that every node kind has a handler, but not that the handler's node parameter is correctly typed. A handler reading `node.banana` on a `redis/set` node compiles clean.

## Approach: NodeTypeMap Registry via Declaration Merging

### Core changes in `fold.ts`

Add an empty interface that plugins extend:

```ts
export interface NodeTypeMap {}
```

Update `CompleteInterpreter` to look up node types from the registry:

```ts
export type CompleteInterpreter<K extends string> = {
  [key in K]: key extends keyof NodeTypeMap
    ? Handler<NodeTypeMap[key]>
    : never;
};
```

- **Registered kinds** get full type checking via `Handler<N>` — both input node type and return type (via phantom `T`).
- **Unregistered kinds** map to `never` — compile error. Every kind must be registered.
- **`Interpreter`** stays as-is (`Record<string, (node: any) => ...>`). It's the untyped runtime record used by `foldAST`.
- **`Handler<N>`** already exists and is unchanged.
- **`NodeTypeMap`** is re-exported from `core/src/index.ts`.

### Plugin registration pattern

Each plugin adds a module augmentation where its node interfaces are defined:

```ts
declare module "@mvfm/core" {
  interface NodeTypeMap {
    "redis/set": RedisSetNode;
    "redis/get": RedisGetNode;
    "redis/del": RedisDelNode;
    // ... every kind the plugin emits
  }
}
```

Core interpreter nodes (`core/literal`, `core/prop_access`, etc.) register in `core/src/interpreters/core.ts`.

### Plugins that must register

All plugins register in this PR — no graduated migration:

- **core** — all `core/*` node kinds
- **plugin-redis** — all `redis/*` node kinds
- **plugin-postgres** — all `postgres/*` node kinds
- **plugin-zod** — all `zod/*` node kinds

## Spike phase (mandatory, before implementation)

A standalone TypeScript file that proves the type machinery holds. **If any hard-stop criterion fails, we reassess the approach rather than continuing.**

### What the spike validates

1. Declaration merging works across modules
2. `CompleteInterpreter<K>` rejects `node: any` for a registered kind
3. `CompleteInterpreter<K>` rejects wrong node types for a kind
4. `CompleteInterpreter<K>` accepts correct node types
5. Spread composition of two well-typed interpreters satisfies `CompleteInterpreter<KA | KB>`
6. `Handler<N>` return type inference works via phantom `T`
7. Unregistered kinds hit `never`

### Hard-stop criteria

- Items 1, 2, or 5 fail → approach is fundamentally broken, stop
- Items 3, 4, 6, or 7 fail → may be fixable with type-level adjustments, pause to evaluate

## Validation (`@ts-expect-error` tests)

After implementation, add compile-time negative tests:

```ts
// @ts-expect-error: 'any' not assignable to specific node type
const bad1: CompleteInterpreter<"redis/set"> = {
  "redis/set": async function* (node: any) { return null; }
};

// @ts-expect-error: wrong node type
const bad2: CompleteInterpreter<"redis/set"> = {
  "redis/set": async function* (node: RedisGetNode) { return null; }
};

// Correct — compiles
const good: CompleteInterpreter<"redis/set"> = {
  "redis/set": async function* (node: RedisSetNode) { /* ... */ return null; }
};

// Spread composition — compiles
const composed: CompleteInterpreter<"redis/set" | "redis/get"> = {
  ...redisSetInterp,
  ...redisGetInterp,
};
```

Checked by `pnpm run build` — no runtime needed. If someone loosens the types, the `@ts-expect-error` lines stop being errors and tsc reports "unused @ts-expect-error."

## What does NOT change

- `Interpreter` type (runtime, stays `any`)
- `foldAST` function (runtime, unchanged)
- `typedFoldAST` function (unchanged)
- `Handler<N>` type (already correct)
- Runtime behavior of any kind
- Plugin `build()` contracts or `PluginDefinition`

## Risks

If a plugin's existing handler signatures don't exactly match `Handler<NodeTypeMap[key]>` (e.g. a handler returns `string` but the phantom type says `string | null`), we'll get compile errors. These are real type bugs being surfaced — fix them, don't loosen the types.
