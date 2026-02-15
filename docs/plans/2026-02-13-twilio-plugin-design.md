# Twilio Plugin — Design

**Date:** 2026-02-13
**Status:** Approved
**Issue:** #55 (parent: #46)
**SDK version:** twilio-node 5.5.1

## Goal

Implement the `twilio` plugin modeling twilio-node. Pass 1 covers Messages (SMS) and Calls (voice) — the two resources that cover >60% of real-world Twilio usage.

## Source-level analysis

Cloned `github.com/twilio/twilio-node` at tag `5.5.1` to `/tmp/twilio-node-5.5.1`.

The SDK is auto-generated from OpenAPI specs. Each resource lives under `src/rest/api/v2010/account/` (for the core API). Resources follow a consistent pattern: `ListInstance` (create, list, each, page) and `Context` (fetch, update, remove). All operations are REST request-response over `https://api.twilio.com` with Basic auth (`accountSid:authToken`).

### Assessment matrix

| Operation | Category | Notes |
|---|---|---|
| `messages.create()` | Maps cleanly | POST to `/2010-04-01/Accounts/{AccountSid}/Messages.json` |
| `messages(sid).fetch()` | Maps cleanly | Mvfm uses `messages(sid).fetch()` — 1:1 match via Object.assign pattern |
| `messages.list()` | Maps cleanly | GET with optional query params (to, from, dateSent, limit) |
| `messages(sid).remove()` | Maps cleanly | DELETE — omitted from pass 1, trivial to add |
| `messages(sid).update()` | Maps cleanly | POST — omitted from pass 1, trivial to add |
| `calls.create()` | Maps cleanly | POST to `/2010-04-01/Accounts/{AccountSid}/Calls.json` |
| `calls(sid).fetch()` | Maps cleanly | Same callable pattern as messages |
| `calls.list()` | Maps cleanly | GET with optional query params |
| `calls(sid).update()` | Maps cleanly | POST — omitted from pass 1 |
| `messages.each()` | Can't model | Async iterator / auto-pagination — push-based |
| Webhooks/status callbacks | Can't model | Server-initiated push events |
| TwiML generation | Can't model | XML construction, not REST API |
| Real-time call control | Can't model | Stateful, TwiML-driven |
| Verify, Conversations, etc. | Maps cleanly | Same REST pattern, future passes |

## Architecture

- **Plugin type:** External-service, configured factory function
- **Version directory:** `src/plugins/twilio/5.5.1/`
- **Effect type:** Uniform `twilio/api_call` (like Stripe)
- **Config:** `{ accountSid: string; authToken: string }`

## Node kinds (6)

| Node Kind | REST Method | Path |
|---|---|---|
| `twilio/create_message` | POST | `/2010-04-01/Accounts/{AccountSid}/Messages.json` |
| `twilio/fetch_message` | GET | `/2010-04-01/Accounts/{AccountSid}/Messages/{Sid}.json` |
| `twilio/list_messages` | GET | `/2010-04-01/Accounts/{AccountSid}/Messages.json` |
| `twilio/create_call` | POST | `/2010-04-01/Accounts/{AccountSid}/Calls.json` |
| `twilio/fetch_call` | GET | `/2010-04-01/Accounts/{AccountSid}/Calls/{Sid}.json` |
| `twilio/list_calls` | GET | `/2010-04-01/Accounts/{AccountSid}/Calls.json` |

## DSL API

```ts
const app = mvfm(twilio({ accountSid: 'AC...', authToken: '...' }));

const program = app(($) => {
  const msg = $.twilio.messages.create({ to: '+15551234567', from: '+15559876543', body: 'Hello' });
  const fetched = $.twilio.messages('SM800f449d...').fetch();
  const msgs = $.twilio.messages.list({ limit: 10 });

  const call = $.twilio.calls.create({ to: '+15551234567', from: '+15559876543', url: 'https://example.com/twiml' });
  const fetchedCall = $.twilio.calls('CA42ed11f9...').fetch();
  const calls = $.twilio.calls.list({ limit: 10 });

  return $.do(msg, fetched, msgs, call, fetchedCall, calls);
});
```

## Interpreter

Single effect type: `twilio/api_call` with `{ method, path, params? }`. AccountSid interpolated into paths from config on each AST node.

## Handlers

- **`handler.server.ts`**: Takes `TwilioClient` interface (`request(method, path, params?)`), delegates to it.
- **`handler.client.ts`**: Generic proxy-over-HTTP (same pattern as Stripe).
- **`client-twilio-sdk.ts`**: Wraps the real `twilio` SDK. Constructs HTTPS requests to `api.twilio.com` with Basic auth header.

## Plugin size

LARGE — at pass 1 of 60/30/10 split (2 of 30+ service domains).

## Files

```
src/plugins/twilio/5.5.1/
  index.ts
  interpreter.ts
  handler.server.ts
  handler.client.ts
  client-twilio-sdk.ts

tests/plugins/twilio/5.5.1/
  index.test.ts
  interpreter.test.ts
  integration.test.ts
```
