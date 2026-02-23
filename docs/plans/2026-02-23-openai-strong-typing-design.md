# Design: Strong-type @mvfm/plugin-openai with OpenAI SDK types

**Date**: 2026-02-23
**Status**: Approved

## Problem

The `@mvfm/plugin-openai` plugin has untyped inputs throughout:

- Constructors use unconstrained generics (`create<A>(params: A)`)
- KindSpecs use `KindSpec<[unknown], unknown>` for all kinds
- The interpreter casts bodies to `Record<string, unknown>`
- A custom `liftArg` + `openai/record` + `openai/array` mechanism duplicates core's structural elaboration

The OpenAI Node SDK has excellent type definitions. A typo like `{ modle: "gpt-4o" }` compiles silently today.

## Goal

Make the plugin faithful to the OpenAI SDK types so that constructor inputs are validated at compile time, KindSpecs carry real types, and the internal plumbing uses the core structural elaboration instead of plugin-specific reimplementations.

## Architecture

### Removed from plugin

- `liftArg()` — recursively wraps objects as `openai/record` CExprs
- `openai/record` kind — KindSpec, interpreter handler
- `openai/array` kind — KindSpec, interpreter handler
- `mk` cast helper

### Added to core (`packages/core`)

**`Liftable<T>` utility type** — recursively allows `CExpr<X>` wherever `X` is expected:

```typescript
export type Liftable<T> =
  T extends CExpr<any, any, any> ? T
  : T extends string ? T | CExpr<string, any, any>
  : T extends number ? T | CExpr<number, any, any>
  : T extends boolean ? T | CExpr<boolean, any, any>
  : T extends null | undefined ? T
  : T extends readonly (infer E)[] ? readonly Liftable<E>[] | CExpr<T, any, any>
  : T extends object ? { [K in keyof T]: Liftable<T[K]> } | CExpr<T, any, any>
  : T | CExpr<T, any, any>;
```

**`resolveStructured()` generator** — reconstructs objects from structural children:

```typescript
export async function* resolveStructured(
  structure: unknown
): AsyncGenerator<string, unknown, unknown> {
  if (typeof structure === "string") return yield structure;
  if (Array.isArray(structure)) {
    const result: unknown[] = [];
    for (const item of structure) result.push(yield* resolveStructured(item));
    return result;
  }
  if (typeof structure === "object" && structure !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(structure))
      result[key] = yield* resolveStructured(value);
    return result;
  }
  return structure;
}
```

**Per-arg shapes in `elaborate.ts`** — extend structural shapes branch to support array shapes for multi-arg kinds:

```typescript
if (kind in structuralShapes) {
  const shape = structuralShapes[kind];
  if (Array.isArray(shape)) {
    const childRefs: unknown[] = [];
    for (let i = 0; i < args.length; i++) {
      childRefs.push(shape[i] ? visitStructural(args[i], shape[i]) : visit(args[i])[0]);
    }
    entries[nodeId] = { kind, children: childRefs as string[], out: undefined };
  } else {
    const childRef = visitStructural(args[0], shape);
    entries[nodeId] = { kind, children: [childRef] as any, out: undefined };
  }
  return cache([nodeId, kindOutputs[kind] ?? "object"]);
}
```

### Added to plugin

**Typed constructors** using OpenAI SDK types + `Liftable<T>`:

```typescript
create(params: Liftable<ChatCompletionCreateParamsNonStreaming>):
  CExpr<ChatCompletion, "openai/create_chat_completion", [...]>
```

**Typed KindSpecs** with real OpenAI input/output types:

```typescript
"openai/create_chat_completion": KindSpec<
  [ChatCompletionCreateParamsNonStreaming], ChatCompletion
>
```

**Shapes declaration** for structural elaboration:

```typescript
shapes: {
  "openai/create_chat_completion": "*",
  "openai/list_chat_completions": "*",
  "openai/update_chat_completion": [null, "*"],
  "openai/create_embedding": "*",
  "openai/create_moderation": "*",
  "openai/create_completion": "*",
}
```

**Updated interpreter** using `resolveStructured`:

```typescript
"openai/create_chat_completion": async function* (entry) {
  const body = yield* resolveStructured(entry.children[0]);
  return await client.request("POST", "/chat/completions", body as Record<string, unknown>);
}
```

## OpenAI SDK Types Used

| Kind | Input Type | Output Type | Import Path |
|------|-----------|-------------|-------------|
| create_chat_completion | `ChatCompletionCreateParamsNonStreaming` | `ChatCompletion` | `openai/resources/chat/completions/completions` |
| retrieve_chat_completion | `string` | `ChatCompletion` | — |
| list_chat_completions | `ChatCompletionListParams` (optional) | `ChatCompletionsPage` | `openai/resources/chat/completions/completions` |
| update_chat_completion | `[string, ChatCompletionUpdateParams]` | `ChatCompletion` | `openai/resources/chat/completions/completions` |
| delete_chat_completion | `string` | `ChatCompletionDeleted` | — |
| create_embedding | `EmbeddingCreateParams` | `CreateEmbeddingResponse` | `openai/resources/embeddings` |
| create_moderation | `ModerationCreateParams` | `ModerationCreateResponse` | `openai/resources/moderations` |
| create_completion | `CompletionCreateParamsNonStreaming` | `Completion` | `openai/resources/completions` |

## How Lifting Works

When a user writes:
```typescript
$.openai.chat.completions.create({
  model: someStringCExpr,
  messages: [{ role: "user", content: "Hello" }],
  temperature: 0.7,
})
```

1. **Constructor** accepts `Liftable<ChatCompletionCreateParamsNonStreaming>`, which allows `CExpr<string>` for `model`
2. **`makeCExpr`** stores the raw object (with embedded CExprs) as `__args[0]`
3. **`elaborate()`** sees the kind in `structuralShapes`, calls `visitStructural(args[0], "*")`
4. **`visitStructural`** recursively walks the object: CExprs are visited normally (returning node IDs), primitives are lifted to `str/literal`/`num/literal`/`bool/literal` nodes, nested objects/arrays are recursed
5. **Result**: `entry.children[0]` is a structured map `{ model: "nodeA", messages: [...], temperature: "nodeB" }` where values are node IDs
6. **Interpreter** uses `yield* resolveStructured(entry.children[0])` to reconstruct the full object by yielding each node ID to the fold

## Test Changes

- Remove tests for `openai/record` and `openai/array` kinds
- Update CExpr construction tests: `expr.__args[0]` is now a raw object, not an `openai/record` CExpr
- Interpreter tests stay the same (same inputs/outputs)
- Add type-level tests verifying misspelled fields cause compile errors
- The `app(expr as Parameters<typeof app>[0])` cast should become unnecessary

## Risks

**TypeScript recursion depth**: `ChatCompletionCreateParamsNonStreaming` has deeply nested types (message unions, tool definitions). `ElaborateRecordFields` might hit TS recursion limits. Mitigation: test incrementally. If it fails, use simplified param types for KindSpec inputs while keeping full types on constructors.

**Core changes**: Per-arg shapes and `resolveStructured` are small, backwards-compatible additions. They benefit any plugin with structural shapes.
