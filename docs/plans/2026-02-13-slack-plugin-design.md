# Slack Plugin Design (`@slack/web-api@7.14.0`)

Issue: #56 | Parent: #46

## Plugin type & sizing

External-service plugin. Version directory: `7.14.0`. LARGE — 275 total methods across 30+ resource groups. Pass 1 targets 5 resource groups (~25 methods) under the 60/30/10 rule.

## Source-level analysis

Cloned `slackapi/node-slack-sdk` at tag `@slack/web-api@7.14.0`. Key findings:

- Every method in `WebClient` is `bindApiCall(this, 'method.name')` → delegates to `apiCall(method, options)`.
- `apiCall` sends `POST https://slack.com/api/{method}` with form-encoded body.
- Pure request-response. No state, no scoping, no transactions.
- 275 methods total. All follow the same pattern.

## Directory structure

```
src/plugins/slack/7.14.0/
  index.ts                 # PluginDefinition + SlackConfig + SlackMethods
  interpreter.ts           # InterpreterFragment, uniform slack/api_call effect
  handler.server.ts        # serverHandler + serverEvaluate
  handler.client.ts        # clientHandler (HTTP proxy)
  client-slack-web-api.ts  # SDK adapter wrapping WebClient

tests/plugins/slack/7.14.0/
  index.test.ts            # AST construction
  interpreter.test.ts      # Effect-yielding with mock handler
  integration.test.ts      # Real WebClient against mock server
```

## Interpreter pattern

Uniform effect — identical to Stripe. One effect type: `slack/api_call` with `{ method: string, params: Record<string, unknown> }`. The handler calls `client.apiCall(method, params)`.

## Pass 1 API surface (25 methods)

| Group | Methods | Node kinds |
|---|---|---|
| **chat** | postMessage, update, delete, postEphemeral, scheduleMessage, getPermalink | 6 |
| **conversations** | list, info, create, invite, history, members, open, replies | 8 |
| **users** | info, list, lookupByEmail, conversations | 4 |
| **reactions** | add, get, list, remove | 4 |
| **files** | list, info, delete | 3 |

Node kind naming: `slack/{group}_{method}` (e.g., `slack/chat_postMessage`, `slack/conversations_list`).

## Config

```ts
export interface SlackConfig {
  token: string;  // xoxb-... or xoxp-...
}
```

Token is baked into every AST node.

## DSL shape

```ts
$.slack.chat.postMessage({ channel: "#general", text: "Hello" })
$.slack.conversations.list({ limit: 100 })
$.slack.users.lookupByEmail({ email: $.input.userEmail })
$.slack.reactions.add({ channel: "C123", timestamp: msg.ts, name: "thumbsup" })
```

Mirrors real `@slack/web-api`: `client.chat.postMessage(...)` → `$.slack.chat.postMessage(...)`.

## SDK adapter

```ts
export interface SlackClient {
  apiCall(method: string, params?: Record<string, unknown>): Promise<unknown>;
}
```

Wraps `WebClient.apiCall(method, params)` behind this interface.

## Honest assessment

### Maps cleanly (all 25 Pass 1 methods)

Every method is request-response `apiCall(method, params)` → 1:1 mapping to `slack/api_call` effect.

### Needs deviation

- **Node kind naming**: Real SDK uses dot notation (`chat.postMessage`). Ilo uses `slack/chat_postMessage` (underscore) because slashes are the plugin namespace separator.

### Can't model

- **Auto-pagination**: `conversations.list` etc. return paginated results with `cursor`. Returns first page only; use `$.rec()` for full pagination.
- **File uploads**: `files.uploadV2` makes 3 internal API calls. Not a single AST node.
- **Real-time events** (RTM, Socket Mode): Push-based, not request-response.
- **Streaming** (`chat.startStream`, `chat.appendStream`): Stateful streaming protocol.
- **Block Kit composition**: No special AST support — blocks are plain JSON objects, handled by `ctx.lift()`.

### Not modeled yet (future passes)

Pass 2 (30%): admin, bookmarks, pins, reminders, views, search, team, dnd, emoji, usergroups.
Pass 3 (10%): Long tail — apps, auth, bots, calls, canvases, dialog, functions, migration, oauth, openid, rtm, stars, tooling, workflows.

## Traits

None. Slack operates on opaque records.
