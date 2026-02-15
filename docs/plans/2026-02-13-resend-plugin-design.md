# Resend Plugin Design

**Date:** 2026-02-13
**Issue:** #51
**Status:** Approved

## Source analysis

**Upstream:** resend-node v6.9.2 (github.com/resend/resend-node)
**Protocol:** Pure REST request-response. Every operation is POST, GET, PATCH, or DELETE against `https://api.resend.com`. No streaming, no websockets, no stateful scoping.

## Assessment matrix

| Operation | Category | Notes |
|---|---|---|
| `emails.send` | Maps cleanly | POST /emails |
| `emails.get` | Maps cleanly | GET /emails/:id |
| `batch.send` | Maps cleanly | POST /emails/batch |
| `contacts.create` | Maps cleanly | POST /contacts |
| `contacts.get` | Maps cleanly | GET /contacts/:id |
| `contacts.list` | Maps cleanly | GET /contacts |
| `contacts.remove` | Maps cleanly | DELETE /contacts/:id |
| `emails.cancel` | Maps cleanly (pass 2) | POST /emails/:id/cancel |
| `emails.update` | Maps cleanly (pass 2) | PATCH /emails/:id |
| `emails.list` | Maps cleanly (pass 2) | GET /emails |
| `domains.*` | Maps cleanly (pass 2) | CRUD + verify |
| `segments.*` | Maps cleanly (pass 2) | CRUD |
| `broadcasts.*` | Maps cleanly (pass 2) | CRUD + send |
| `apiKeys.*` | Maps cleanly (pass 2) | CRUD |
| `emails.send` (react option) | Needs deviation | React rendering is a build-time side effect; use `html` instead |
| `webhooks` | Can't model | Push-based, not request-response |
| `emails.attachments` (Buffer content) | Needs deviation | Binary data in AST is awkward; path-based attachments work |

## Scope

**Plugin size:** MEDIUM — pass 1 of 75/25 split (7 operations).

**Pass 1 (75%):** emails.send, emails.get, batch.send, contacts.create, contacts.get, contacts.list, contacts.remove

**Pass 2 (25%):** emails.cancel, emails.update, emails.list, domains CRUD + verify, segments CRUD, broadcasts CRUD + send, apiKeys CRUD

## Architecture

### Effect type

Single uniform effect: `resend/api_call` with `{ method, path, params? }`. Identical to the Stripe pattern. Every node kind maps to one HTTP request.

### Directory structure

```
src/plugins/resend/6.9.2/
  index.ts              # PluginDefinition + ResendConfig + ResendMethods
  interpreter.ts        # InterpreterFragment (const), resend/api_call effect
  handler.server.ts     # serverHandler + serverEvaluate
  handler.client.ts     # clientHandler (HTTP proxy)
  client-resend-sdk.ts  # wrapResendSdk adapter

tests/plugins/resend/6.9.2/
  index.test.ts         # Tier 1: AST construction
  interpreter.test.ts   # Tier 2: effect yielding with mock handler
  integration.test.ts   # Tier 3: real API against mock server
```

### Node kinds

- `resend/send_email`
- `resend/get_email`
- `resend/send_batch`
- `resend/create_contact`
- `resend/get_contact`
- `resend/list_contacts`
- `resend/remove_contact`

### Config

```ts
interface ResendConfig {
  apiKey: string;
}
```

Baked into every AST node per the plugin authoring guide.

### SDK adapter interface

```ts
export interface ResendClient {
  request(method: string, path: string, params?: unknown): Promise<unknown>;
}
```

`wrapResendSdk(resend: Resend)` routes to `resend.post()`, `resend.get()`, `resend.delete()` by method. Unwraps `{ data, error }` envelope: returns `data` on success, throws on error.

### DSL surface

```ts
// Real resend-node:
const resend = new Resend('re_123');
await resend.emails.send({ from: '...', to: '...', subject: '...', html: '...' });
await resend.emails.get('email_id');
await resend.batch.send([{ from: '...', to: '...' }]);
await resend.contacts.create({ email: '...' });
await resend.contacts.get('contact_id');
await resend.contacts.list();
await resend.contacts.remove('contact_id');

// Mvfm:
const app = mvfm(num, str, resend({ apiKey: 're_123' }));
app(($) => {
  const email = $.resend.emails.send({ from: '...', to: '...', subject: '...', html: '...' });
  const fetched = $.resend.emails.get('email_id');
  const batch = $.resend.batch.send([{ from: '...', to: '...' }]);
  const contact = $.resend.contacts.create({ email: '...' });
  const got = $.resend.contacts.get('contact_id');
  const all = $.resend.contacts.list();
  const removed = $.resend.contacts.remove('contact_id');
  return $.do(email, fetched, batch, contact, got, all, removed);
});
```

### Design decisions

1. **Error handling:** SDK adapter unwraps `{ data, error }` — returns `data` on success, throws on error. Mvfm's error plugin handles errors at the DSL level.
2. **No react support:** Documented as deviation. Users pass `html` or `text`.
3. **`batch.send` takes array param:** Interpreter resolves via recurse, posts to `/emails/batch`.
4. **`contacts.get` takes string ID:** Simple case only. Overloaded `{ id?, email?, audienceId? }` form deferred to pass 2.
5. **`contacts.list` takes no params:** Simple GET /contacts. Pagination deferred to pass 2.
6. **Integration tests:** No official Resend mock container exists. Use a lightweight HTTP mock server (msw or similar) to test the full handler chain.
