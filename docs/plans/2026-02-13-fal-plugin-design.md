# Design: fal Plugin (@fal-ai/client)

**Date:** 2026-02-13
**Issue:** #54 (parent: #46)
**Status:** Approved

## Summary

Implement the `fal` external-service plugin wrapping `@fal-ai/client` v1.9.1. Models AI media generation (image, video, audio) via fal.ai's endpoint-based API.

## Source-Level Analysis

Based on reading the full source of `@fal-ai/client` at https://github.com/fal-ai/fal-js (libs/client/src/).

### API Surface Assessment

| Operation | Category | Rationale |
|-----------|----------|-----------|
| `fal.run(endpointId, options)` | Maps cleanly | Pure request-response. POST to endpoint, get JSON result. |
| `fal.subscribe(endpointId, options)` | Maps cleanly | Queue submit + poll + result. Still request-response from caller's perspective. |
| `fal.queue.submit(endpointId, options)` | Maps cleanly | POST to queue subdomain, returns `{ request_id }`. |
| `fal.queue.status(endpointId, { requestId })` | Maps cleanly | GET status by request ID. |
| `fal.queue.result(endpointId, { requestId })` | Maps cleanly | GET result by request ID. |
| `fal.queue.cancel(endpointId, { requestId })` | Maps cleanly | PUT cancel by request ID. |
| `fal.stream(endpointId, options)` | Can't model | SSE push-based streaming. Returns `FalStream` with async iterator and event listeners. No finite AST shape. |
| `fal.realtime.connect(app, handler)` | Can't model | WebSocket bidirectional connection with state machine (robot3). Fundamentally incompatible with request-response AST. |
| `fal.storage.upload(file)` | Maps cleanly but deferred | Blob upload returning URL. Could be modeled but deferred — not needed for "prove the pattern" scope. |
| `fal.storage.transformInput(input)` | Can't model | Recursive Blob-to-URL transformation of arbitrary input objects. Runtime concern, not AST-representable. |

### Plugin Size

**SMALL** — 6 modelable operations in scope, all following the same request-response pattern.

## Design

### Deviations from Real API

1. **Non-modelable options silently ignored:** Real SDK `RunOptions` includes `method`, `abortSignal`, `storageSettings`, `startTimeout`. Ilo accepts the same `{ input: ... }` shape but only extracts `input` — runtime options are not AST-representable. Similarly, `QueueStatusOptions` includes `logs` and `abortSignal` which are ignored.

2. **Callbacks dropped:** `subscribe` in the real SDK accepts `onQueueUpdate` and `onEnqueue` callbacks. Not modelable in AST.

### Plugin API (1:1 with real SDK)

```typescript
// Configuration
fal({ credentials: "key_..." })

// Direct execution — same signature as real fal.run()
const result = $.fal.run("fal-ai/flux/dev", { input: { prompt: "a cat" } });

// Queue-based — same signature as real fal.subscribe()
const result = $.fal.subscribe("fal-ai/flux/dev", { input: { prompt: "a cat" } });

// Granular queue control — same signatures as real fal.queue.*
const queued = $.fal.queue.submit("fal-ai/flux/dev", { input: { prompt: "a cat" } });
const status = $.fal.queue.status("fal-ai/flux/dev", { requestId: queued.request_id });
const result = $.fal.queue.result("fal-ai/flux/dev", { requestId: queued.request_id });
const cancel = $.fal.queue.cancel("fal-ai/flux/dev", { requestId: queued.request_id });
```

The builder methods unwrap the options objects to extract `input` or `requestId` for the AST — the user-facing API matches the real SDK exactly.

### Node Kinds (6)

| Node kind | Effect type | Description |
|-----------|-------------|-------------|
| `fal/run` | `fal/api_call` | Synchronous endpoint execution |
| `fal/subscribe` | `fal/subscribe` | Queue submit + poll + result (composite) |
| `fal/queue_submit` | `fal/api_call` | Submit to queue |
| `fal/queue_status` | `fal/api_call` | Check queue status |
| `fal/queue_result` | `fal/api_call` | Retrieve queue result |
| `fal/queue_cancel` | `fal/api_call` | Cancel queued request |

### Effect Types

- **`fal/api_call`**: Single HTTP request. Carries `{ endpointId, method, input?, requestId? }`. The handler dispatches to the real SDK.
- **`fal/subscribe`**: Composite operation (submit + poll + result). The handler uses `fal.subscribe()` which internally manages polling. This is a single effect because the subscribe flow is atomic from the AST's perspective.

### Files

```
src/plugins/fal/1.9.1/
  index.ts            # PluginDefinition<FalMethods> + config
  interpreter.ts      # InterpreterFragment + FalClient interface
  handler.server.ts   # Server StepHandler wrapping real SDK
  handler.client.ts   # Client StepHandler (HTTP proxy, same as stripe)
  client-fal-sdk.ts   # Wraps @fal-ai/client into FalClient interface

tests/plugins/fal/1.9.1/
  index.test.ts       # AST construction tests
  interpreter.test.ts # Effect-yielding tests with mock handlers
  integration.test.ts # Real SDK tests (if feasible)
```

### FalClient Interface (interpreter.ts)

```typescript
export interface FalClient {
  run(endpointId: string, input?: Record<string, unknown>): Promise<unknown>;
  subscribe(endpointId: string, input?: Record<string, unknown>): Promise<unknown>;
  queueSubmit(endpointId: string, input?: Record<string, unknown>): Promise<unknown>;
  queueStatus(endpointId: string, requestId: string): Promise<unknown>;
  queueResult(endpointId: string, requestId: string): Promise<unknown>;
  queueCancel(endpointId: string, requestId: string): Promise<void>;
}
```

### Honest Assessment

**Works great:**
- `fal.run()` and `fal.subscribe()` are 1:1 with real SDK signatures. An LLM trained on @fal-ai/client can write Ilo fal programs with zero adaptation.
- Queue operations (submit/status/result/cancel) use identical signatures — `{ input: ... }`, `{ requestId: ... }`.
- Proxy chains work for data flow: `queued.request_id` captures the dependency inside `{ requestId: queued.request_id }`.

**Works but different:**
- Non-modelable RunOptions fields (`method`, `abortSignal`, `storageSettings`) are silently ignored.
- Return types are `Record<string, unknown>` instead of model-specific output types.
- `subscribe` callbacks (`onQueueUpdate`, `onEnqueue`) are not modelable in AST.

**Doesn't work / not modeled:**
- `fal.stream()` — SSE streaming, push-based
- `fal.realtime.connect()` — WebSocket, stateful bidirectional
- `fal.storage.upload()` — deferred, not in scope
- `fal.storage.transformInput()` — recursive Blob transformation, runtime concern
- Auto-upload of Blob/File inputs — runtime concern handled by SDK adapter
