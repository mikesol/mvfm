# Issue #88: Twilio Plugin — Align Resource Typing with twilio-node

## Problem

The Twilio plugin uses `Record<string, unknown>` for all operation parameters and return types, weakening type parity with twilio-node SDK.

## Decision

Import types directly from `twilio` package (as a devDependency) rather than redefining them. Re-export from a local `types.ts` for clean internal imports.

## Changes

### 1. New file: `packages/plugin-twilio/src/5.5.1/types.ts`

Re-exports from twilio-node's deep paths:

- **Messages:** `MessageInstance`, `MessageListInstanceCreateOptions`, `MessageListInstancePageOptions`
- **Calls:** `CallInstance`, `CallListInstanceCreateOptions`, `CallListInstancePageOptions`

Type-only imports keep bundle size zero.

### 2. Update `packages/plugin-twilio/package.json`

Add `twilio` as a devDependency for type access.

### 3. Update `packages/plugin-twilio/src/5.5.1/index.ts`

Replace `Record<string, unknown>` in all interfaces:

| Interface | Field | Before | After |
|-----------|-------|--------|-------|
| `TwilioMessageContext` | `fetch()` return | `Expr<Record<string, unknown>>` | `Expr<MessageInstance>` |
| `TwilioMessagesResource` | `create()` params | `Record<string, unknown>` | `MessageListInstanceCreateOptions` |
| `TwilioMessagesResource` | `create()` return | `Expr<Record<string, unknown>>` | `Expr<MessageInstance>` |
| `TwilioMessagesResource` | `list()` params | `Record<string, unknown>` | `MessageListInstancePageOptions` |
| `TwilioMessagesResource` | `list()` return | `Expr<Record<string, unknown>>` | `Expr<MessageInstance[]>` |
| `TwilioCallContext` | `fetch()` return | `Expr<Record<string, unknown>>` | `Expr<CallInstance>` |
| `TwilioCallsResource` | `create()` params | `Record<string, unknown>` | `CallListInstanceCreateOptions` |
| `TwilioCallsResource` | `create()` return | `Expr<Record<string, unknown>>` | `Expr<CallInstance>` |
| `TwilioCallsResource` | `list()` params | `Record<string, unknown>` | `CallListInstancePageOptions` |
| `TwilioCallsResource` | `list()` return | `Expr<Record<string, unknown>>` | `Expr<CallInstance[]>` |

### 4. Update `packages/plugin-twilio/src/5.5.1/interpreter.ts`

Update `TypedNode` phantom types in node interfaces and `NodeTypeMap` augmentation to match the new specific types.

## Deviations

- twilio-node's `TwiML | string` for call creation → we pass `string` through (DSL doesn't model TwiML objects). Documented inline.

## Size budget

- `types.ts`: ~15 lines (type-only re-exports)
- `index.ts`: net change ~0 lines (replacing types, not adding)
- `interpreter.ts`: net change ~0 lines (same)

## Validation

`npm run build && npm run check && npm test`
