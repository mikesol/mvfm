# Fal Plugin Types Fidelity — Design

**Date:** 2026-02-15
**Status:** Approved
**Issue:** #79
**SDK version:** @fal-ai/client 1.9.1

## Goal

Tighten the `@mvfm/plugin-fal` types and runtime handling to fully match `@fal-ai/client` for the already implemented surface only:
- `run`
- `subscribe`
- `queue.submit`
- `queue.status`
- `queue.result`
- `queue.cancel`

No new service areas (`stream`, `realtime`, `storage.upload`) are added in this issue.

## Source-level analysis

Reviewed `@fal-ai/client` source from `/tmp/fal-js-issue79`:
- `/tmp/fal-js-issue79/libs/client/src/client.ts`
- `/tmp/fal-js-issue79/libs/client/src/queue.ts`
- `/tmp/fal-js-issue79/libs/client/src/types/common.ts`
- `/tmp/fal-js-issue79/libs/client/src/types/client.ts`

Relevant SDK contracts for implemented methods:
- `run<Id extends EndpointType>(endpointId: Id, options: RunOptions<InputType<Id>>): Promise<Result<OutputType<Id>>>`
- `subscribe<Id extends EndpointType>(endpointId: Id, options: RunOptions<InputType<Id>> & QueueSubscribeOptions): Promise<Result<OutputType<Id>>>`
- `queue.submit<Id extends EndpointType>(endpointId: Id, options: SubmitOptions<InputType<Id>>): Promise<InQueueQueueStatus>`
- `queue.status(endpointId: string, options: QueueStatusOptions): Promise<QueueStatus>`
- `queue.result<Id extends EndpointType>(endpointId: Id, options: BaseQueueOptions): Promise<Result<OutputType<Id>>>`
- `queue.cancel(endpointId: string, options: BaseQueueOptions): Promise<void>`

## Current gap in plugin

Current plugin signatures and runtime are overly broad:
- Public API and internal interfaces use `Record<string, unknown>` / `unknown` broadly.
- Only `input` is modeled for `run`, `subscribe`, and `queue.submit`.
- Additional SDK options (`method`, `abortSignal`, `storageSettings`, `startTimeout`, queue options) are currently ignored or not representable.

Files affected by this gap:
- `packages/plugin-fal/src/1.9.1/index.ts`
- `packages/plugin-fal/src/1.9.1/interpreter.ts`
- `packages/plugin-fal/src/1.9.1/client-fal-sdk.ts`
- `packages/plugin-fal/src/1.9.1/handler.server.ts`

## Design decisions

### 1. Public API type parity for implemented methods

Adopt SDK-derived public types for implemented methods and responses:
- Request options based on `RunOptions`, `SubmitOptions`, `QueueStatusOptions`, `BaseQueueOptions`, `QueueSubscribeOptions`.
- Return types based on `Result`, `InQueueQueueStatus`, `QueueStatus`, `void`.

### 2. Endpoint typing strategy

Support both typed and dynamic endpoint usage with overloads:
- Literal endpoint overloads preserve endpoint-specific `OutputType<Id>` where possible.
- Dynamic endpoint (`Expr<string>`) overloads fall back to broader `Result<unknown>` / `unknown` output typing.

This preserves SDK-like typing without breaking existing expression-based endpoint composition.

### 3. Runtime parity for option passthrough

For implemented methods, stop silently dropping supported SDK fields.

AST nodes will carry full options payloads required for each implemented method (not only `input`). Interpreter effects and server handler calls will pass those option payloads through to the adapter/client methods.

### 4. Determinism and non-modelable fields

If any typed SDK field on this implemented surface cannot be represented safely/deterministically in AST (for example, runtime-only objects), it must be handled explicitly:
- either represented via a deterministic placeholder strategy, or
- excluded from the plugin’s public options type with explicit documentation.

No silent omission.

### 5. No scope expansion

Out-of-scope for this issue:
- `stream`
- `realtime`
- `storage.upload`

## Test strategy

Three-tier test updates for parity claims:

1. AST builder tests (`index.test.ts`)
- Verify each implemented method captures full expected option payload in AST nodes.

2. Interpreter tests (`interpreter.test.ts`)
- Verify emitted effects include full options payload for each method.

3. Integration tests (`integration.test.ts`)
- Verify server evaluation path passes options through adapter/handler to underlying client semantics for implemented methods.

Also run project verification gates before completion:
- `npm run build`
- `npm run check`
- `npm test`

## Risks

- `@fal-ai/client` types include runtime objects (for example `AbortSignal`) that may require explicit representation decisions.
- Endpoint-dependent generic typing may be constrained when endpoint IDs are expression values.

Mitigation: overload-based API and explicit deviation docs/tests where AST constraints apply.
