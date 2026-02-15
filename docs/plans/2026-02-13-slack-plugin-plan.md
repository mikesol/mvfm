# Slack Plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the `slack` plugin wrapping `@slack/web-api@7.14.0` with 25 methods across 5 resource groups (chat, conversations, users, reactions, files).

**Architecture:** External-service plugin following the exact same uniform-effect pattern as Stripe. One effect type (`slack/api_call`) with `method` string and `params`. SDK adapter wraps `WebClient.apiCall()`.

**Tech Stack:** TypeScript, vitest, `@slack/web-api` SDK

**Design doc:** `docs/plans/2026-02-13-slack-plugin-design.md`

---

### Task 1: Plugin Definition (`index.ts`)

**Files:**
- Create: `src/plugins/slack/7.14.0/index.ts`
- Test: `tests/plugins/slack/7.14.0/index.test.ts`

**Step 1: Write the failing test**

Create `tests/plugins/slack/7.14.0/index.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ilo } from "../../../../src/core";
import { num } from "../../../../src/plugins/num";
import { str } from "../../../../src/plugins/str";
import { slack } from "../../../../src/plugins/slack/7.14.0";

function strip(ast: unknown): unknown {
  return JSON.parse(
    JSON.stringify(ast, (k, v) => (k === "__id" || k === "config" ? undefined : v)),
  );
}

const app = ilo(num, str, slack({ token: "xoxb-test-token" }));

// ============================================================
// chat
// ============================================================

describe("slack: chat.postMessage", () => {
  it("produces slack/chat_postMessage node", () => {
    const prog = app(($) => {
      return $.slack.chat.postMessage({ channel: "#general", text: "Hello" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/chat_postMessage");
    expect(ast.result.params.kind).toBe("core/record");
    expect(ast.result.params.fields.channel.value).toBe("#general");
    expect(ast.result.params.fields.text.value).toBe("Hello");
  });

  it("accepts Expr params", () => {
    const prog = app(($) => {
      return $.slack.chat.postMessage({
        channel: $.input.channel,
        text: $.input.message,
      });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/chat_postMessage");
    expect(ast.result.params.fields.channel.kind).toBe("core/prop_access");
    expect(ast.result.params.fields.text.kind).toBe("core/prop_access");
  });
});

describe("slack: chat.update", () => {
  it("produces slack/chat_update node", () => {
    const prog = app(($) => {
      return $.slack.chat.update({ channel: "C123", ts: "1234567890.123456", text: "Updated" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/chat_update");
    expect(ast.result.params.kind).toBe("core/record");
  });
});

describe("slack: chat.delete", () => {
  it("produces slack/chat_delete node", () => {
    const prog = app(($) => {
      return $.slack.chat.delete({ channel: "C123", ts: "1234567890.123456" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/chat_delete");
  });
});

describe("slack: chat.postEphemeral", () => {
  it("produces slack/chat_postEphemeral node", () => {
    const prog = app(($) => {
      return $.slack.chat.postEphemeral({ channel: "C123", user: "U123", text: "Secret" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/chat_postEphemeral");
  });
});

describe("slack: chat.scheduleMessage", () => {
  it("produces slack/chat_scheduleMessage node", () => {
    const prog = app(($) => {
      return $.slack.chat.scheduleMessage({ channel: "C123", text: "Later", post_at: 1234567890 });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/chat_scheduleMessage");
  });
});

describe("slack: chat.getPermalink", () => {
  it("produces slack/chat_getPermalink node", () => {
    const prog = app(($) => {
      return $.slack.chat.getPermalink({ channel: "C123", message_ts: "1234567890.123456" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/chat_getPermalink");
  });
});

// ============================================================
// conversations
// ============================================================

describe("slack: conversations.list", () => {
  it("produces slack/conversations_list with params", () => {
    const prog = app(($) => {
      return $.slack.conversations.list({ limit: 100 });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/conversations_list");
    expect(ast.result.params.fields.limit.value).toBe(100);
  });

  it("optional params are null when omitted", () => {
    const prog = app(($) => {
      return $.slack.conversations.list();
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/conversations_list");
    expect(ast.result.params).toBeNull();
  });
});

describe("slack: conversations.info", () => {
  it("produces slack/conversations_info node", () => {
    const prog = app(($) => {
      return $.slack.conversations.info({ channel: "C123" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/conversations_info");
  });
});

describe("slack: conversations.create", () => {
  it("produces slack/conversations_create node", () => {
    const prog = app(($) => {
      return $.slack.conversations.create({ name: "new-channel" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/conversations_create");
  });
});

describe("slack: conversations.invite", () => {
  it("produces slack/conversations_invite node", () => {
    const prog = app(($) => {
      return $.slack.conversations.invite({ channel: "C123", users: "U123,U456" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/conversations_invite");
  });
});

describe("slack: conversations.history", () => {
  it("produces slack/conversations_history node", () => {
    const prog = app(($) => {
      return $.slack.conversations.history({ channel: "C123", limit: 50 });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/conversations_history");
  });
});

describe("slack: conversations.members", () => {
  it("produces slack/conversations_members node", () => {
    const prog = app(($) => {
      return $.slack.conversations.members({ channel: "C123" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/conversations_members");
  });
});

describe("slack: conversations.open", () => {
  it("produces slack/conversations_open node", () => {
    const prog = app(($) => {
      return $.slack.conversations.open({ users: "U123,U456" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/conversations_open");
  });
});

describe("slack: conversations.replies", () => {
  it("produces slack/conversations_replies node", () => {
    const prog = app(($) => {
      return $.slack.conversations.replies({ channel: "C123", ts: "1234567890.123456" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/conversations_replies");
  });
});

// ============================================================
// users
// ============================================================

describe("slack: users.info", () => {
  it("produces slack/users_info node", () => {
    const prog = app(($) => {
      return $.slack.users.info({ user: "U123" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/users_info");
  });
});

describe("slack: users.list", () => {
  it("produces slack/users_list with optional params", () => {
    const prog = app(($) => {
      return $.slack.users.list({ limit: 200 });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/users_list");
  });

  it("optional params are null when omitted", () => {
    const prog = app(($) => {
      return $.slack.users.list();
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/users_list");
    expect(ast.result.params).toBeNull();
  });
});

describe("slack: users.lookupByEmail", () => {
  it("produces slack/users_lookupByEmail node", () => {
    const prog = app(($) => {
      return $.slack.users.lookupByEmail({ email: "user@example.com" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/users_lookupByEmail");
  });
});

describe("slack: users.conversations", () => {
  it("produces slack/users_conversations with optional params", () => {
    const prog = app(($) => {
      return $.slack.users.conversations({ user: "U123" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/users_conversations");
  });
});

// ============================================================
// reactions
// ============================================================

describe("slack: reactions.add", () => {
  it("produces slack/reactions_add node", () => {
    const prog = app(($) => {
      return $.slack.reactions.add({ channel: "C123", timestamp: "1234567890.123456", name: "thumbsup" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/reactions_add");
  });
});

describe("slack: reactions.get", () => {
  it("produces slack/reactions_get node", () => {
    const prog = app(($) => {
      return $.slack.reactions.get({ channel: "C123", timestamp: "1234567890.123456" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/reactions_get");
  });
});

describe("slack: reactions.list", () => {
  it("optional params are null when omitted", () => {
    const prog = app(($) => {
      return $.slack.reactions.list();
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/reactions_list");
    expect(ast.result.params).toBeNull();
  });
});

describe("slack: reactions.remove", () => {
  it("produces slack/reactions_remove node", () => {
    const prog = app(($) => {
      return $.slack.reactions.remove({ channel: "C123", timestamp: "1234567890.123456", name: "thumbsup" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/reactions_remove");
  });
});

// ============================================================
// files
// ============================================================

describe("slack: files.list", () => {
  it("produces slack/files_list with optional params", () => {
    const prog = app(($) => {
      return $.slack.files.list({ channel: "C123" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/files_list");
  });

  it("optional params are null when omitted", () => {
    const prog = app(($) => {
      return $.slack.files.list();
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/files_list");
    expect(ast.result.params).toBeNull();
  });
});

describe("slack: files.info", () => {
  it("produces slack/files_info node", () => {
    const prog = app(($) => {
      return $.slack.files.info({ file: "F123" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/files_info");
  });
});

describe("slack: files.delete", () => {
  it("produces slack/files_delete node", () => {
    const prog = app(($) => {
      return $.slack.files.delete({ file: "F123" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/files_delete");
  });
});

// ============================================================
// Integration: $.do(), orphan detection, cross-operation deps
// ============================================================

describe("slack: integration with $.do()", () => {
  it("side-effecting operations wrapped in $.do() are reachable", () => {
    expect(() => {
      app(($) => {
        const msg = $.slack.chat.postMessage({ channel: "#general", text: "Hello" });
        const reaction = $.slack.reactions.add({ channel: "#general", timestamp: (msg as any).ts, name: "thumbsup" });
        return $.do(msg, reaction);
      });
    }).not.toThrow();
  });

  it("orphaned operations are rejected", () => {
    expect(() => {
      app(($) => {
        const info = $.slack.conversations.info({ channel: "C123" });
        $.slack.chat.postMessage({ channel: "C123", text: "orphan!" }); // orphan!
        return info;
      });
    }).toThrow(/unreachable node/i);
  });
});

describe("slack: cross-operation dependencies", () => {
  it("can use result of one operation as input to another", () => {
    const prog = app(($) => {
      const user = $.slack.users.lookupByEmail({ email: "user@example.com" });
      const msg = $.slack.chat.postMessage({
        channel: "#general",
        text: "Hello",
        user: (user as any).user.id,
      });
      return $.do(user, msg);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("core/do");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/plugins/slack/7.14.0/index.test.ts`
Expected: FAIL — module `src/plugins/slack/7.14.0` does not exist

**Step 3: Write the plugin definition**

Create `src/plugins/slack/7.14.0/index.ts`. Follow the Stripe pattern exactly — factory function returning `PluginDefinition<SlackMethods>`.

All 25 methods follow ONE of two patterns:
- **Required params**: `method(params: Expr<R> | R): Expr<R>` — always takes params
- **Optional params**: `method(params?: Expr<R> | R): Expr<R>` — params can be omitted (stores `null`)

Node kind naming: `slack/{group}_{methodName}` (e.g., `slack/chat_postMessage`).

Every method in `build()` does:
```ts
methodName(params) {
  return ctx.expr({
    kind: "slack/{group}_{methodName}",
    params: resolveParams(params),
    config,
  });
}
```

For optional params:
```ts
methodName(params?) {
  return ctx.expr({
    kind: "slack/{group}_{methodName}",
    params: params != null ? resolveParams(params) : null,
    config,
  });
}
```

The complete node kinds list (25 total):
```
slack/chat_postMessage
slack/chat_update
slack/chat_delete
slack/chat_postEphemeral
slack/chat_scheduleMessage
slack/chat_getPermalink
slack/conversations_list
slack/conversations_info
slack/conversations_create
slack/conversations_invite
slack/conversations_history
slack/conversations_members
slack/conversations_open
slack/conversations_replies
slack/users_info
slack/users_list
slack/users_lookupByEmail
slack/users_conversations
slack/reactions_add
slack/reactions_get
slack/reactions_list
slack/reactions_remove
slack/files_list
slack/files_info
slack/files_delete
```

Methods with **optional** params (can be called with no arguments):
- `conversations.list`
- `users.list`
- `reactions.list`
- `files.list`

All other methods have **required** params.

The header comment must include the implementation status, plugin size, honest assessment, and source-level analysis notes per the plugin authoring guide. Reference `docs/plans/2026-02-13-slack-plugin-design.md` for the honest assessment content.

**Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/plugins/slack/7.14.0/index.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/plugins/slack/7.14.0/index.ts tests/plugins/slack/7.14.0/index.test.ts
git commit -m "feat(slack): add plugin definition with 25 node kinds across 5 resource groups (#56)"
```

---

### Task 2: Interpreter Fragment (`interpreter.ts`)

**Files:**
- Create: `src/plugins/slack/7.14.0/interpreter.ts`
- Test: `tests/plugins/slack/7.14.0/interpreter.test.ts`

**Step 1: Write the failing test**

Create `tests/plugins/slack/7.14.0/interpreter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { foldAST, ilo } from "../../../../src/core";
import { coreInterpreter } from "../../../../src/interpreters/core";
import { num } from "../../../../src/plugins/num";
import { str } from "../../../../src/plugins/str";
import { slack } from "../../../../src/plugins/slack/7.14.0";
import { slackInterpreter } from "../../../../src/plugins/slack/7.14.0/interpreter";

const app = ilo(num, str, slack({ token: "xoxb-test-token" }));
const fragments = [slackInterpreter, coreInterpreter];

function injectInput(node: any, input: Record<string, unknown>): any {
  if (node === null || node === undefined || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map((n) => injectInput(n, input));
  const result: any = {};
  for (const [k, v] of Object.entries(node)) {
    result[k] = injectInput(v, input);
  }
  if (result.kind === "core/input") result.__inputData = input;
  return result;
}

async function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const captured: any[] = [];
  const ast = injectInput(prog.ast, input);
  const recurse = foldAST(fragments, {
    "slack/api_call": async (effect) => {
      captured.push(effect);
      return { ok: true, channel: "C123", ts: "1234567890.123456" };
    },
  });
  const result = await recurse(ast.result);
  return { result, captured };
}

// ---- chat ----

describe("slack interpreter: chat_postMessage", () => {
  it("yields slack/api_call with chat.postMessage method", async () => {
    const prog = app(($) => $.slack.chat.postMessage({ channel: "#general", text: "Hello" }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("slack/api_call");
    expect(captured[0].method).toBe("chat.postMessage");
    expect(captured[0].params).toEqual({ channel: "#general", text: "Hello" });
  });
});

describe("slack interpreter: chat_update", () => {
  it("yields slack/api_call with chat.update method", async () => {
    const prog = app(($) => $.slack.chat.update({ channel: "C123", ts: "123.456", text: "Updated" }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("chat.update");
    expect(captured[0].params).toEqual({ channel: "C123", ts: "123.456", text: "Updated" });
  });
});

describe("slack interpreter: chat_delete", () => {
  it("yields slack/api_call with chat.delete method", async () => {
    const prog = app(($) => $.slack.chat.delete({ channel: "C123", ts: "123.456" }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("chat.delete");
  });
});

describe("slack interpreter: chat_postEphemeral", () => {
  it("yields slack/api_call with chat.postEphemeral method", async () => {
    const prog = app(($) => $.slack.chat.postEphemeral({ channel: "C123", user: "U123", text: "Shhh" }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("chat.postEphemeral");
  });
});

describe("slack interpreter: chat_scheduleMessage", () => {
  it("yields slack/api_call with chat.scheduleMessage method", async () => {
    const prog = app(($) => $.slack.chat.scheduleMessage({ channel: "C123", text: "Later", post_at: 9999999999 }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("chat.scheduleMessage");
  });
});

describe("slack interpreter: chat_getPermalink", () => {
  it("yields slack/api_call with chat.getPermalink method", async () => {
    const prog = app(($) => $.slack.chat.getPermalink({ channel: "C123", message_ts: "123.456" }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("chat.getPermalink");
  });
});

// ---- conversations ----

describe("slack interpreter: conversations_list", () => {
  it("yields slack/api_call with conversations.list method", async () => {
    const prog = app(($) => $.slack.conversations.list({ limit: 100 }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("conversations.list");
    expect(captured[0].params).toEqual({ limit: 100 });
  });

  it("yields with undefined params when omitted", async () => {
    const prog = app(($) => $.slack.conversations.list());
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("conversations.list");
    expect(captured[0].params).toBeUndefined();
  });
});

describe("slack interpreter: conversations_info", () => {
  it("yields slack/api_call with conversations.info method", async () => {
    const prog = app(($) => $.slack.conversations.info({ channel: "C123" }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("conversations.info");
  });
});

describe("slack interpreter: conversations_history", () => {
  it("yields slack/api_call with conversations.history method", async () => {
    const prog = app(($) => $.slack.conversations.history({ channel: "C123", limit: 50 }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("conversations.history");
  });
});

// ---- users ----

describe("slack interpreter: users_info", () => {
  it("yields slack/api_call with users.info method", async () => {
    const prog = app(($) => $.slack.users.info({ user: "U123" }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("users.info");
  });
});

describe("slack interpreter: users_lookupByEmail", () => {
  it("yields slack/api_call with users.lookupByEmail method", async () => {
    const prog = app(($) => $.slack.users.lookupByEmail({ email: "user@example.com" }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("users.lookupByEmail");
  });
});

// ---- reactions ----

describe("slack interpreter: reactions_add", () => {
  it("yields slack/api_call with reactions.add method", async () => {
    const prog = app(($) => $.slack.reactions.add({ channel: "C123", timestamp: "123.456", name: "thumbsup" }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("reactions.add");
  });
});

describe("slack interpreter: reactions_list", () => {
  it("yields with undefined params when omitted", async () => {
    const prog = app(($) => $.slack.reactions.list());
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("reactions.list");
    expect(captured[0].params).toBeUndefined();
  });
});

// ---- files ----

describe("slack interpreter: files_list", () => {
  it("yields slack/api_call with files.list method", async () => {
    const prog = app(($) => $.slack.files.list({ channel: "C123" }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("files.list");
  });
});

describe("slack interpreter: files_info", () => {
  it("yields slack/api_call with files.info method", async () => {
    const prog = app(($) => $.slack.files.info({ file: "F123" }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("files.info");
  });
});

describe("slack interpreter: files_delete", () => {
  it("yields slack/api_call with files.delete method", async () => {
    const prog = app(($) => $.slack.files.delete({ file: "F123" }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("files.delete");
  });
});

// ---- input resolution ----

describe("slack interpreter: input resolution", () => {
  it("resolves input params through recurse", async () => {
    const prog = app({ channel: "string", message: "string" }, ($) =>
      $.slack.chat.postMessage({
        channel: $.input.channel,
        text: $.input.message,
      }),
    );
    const { captured } = await run(prog, { channel: "#alerts", message: "Fire!" });
    expect(captured).toHaveLength(1);
    expect(captured[0].params).toEqual({ channel: "#alerts", text: "Fire!" });
  });
});

// ---- return value ----

describe("slack interpreter: return value", () => {
  it("returns the handler response as the result", async () => {
    const prog = app(($) => $.slack.chat.postMessage({ channel: "#general", text: "Hi" }));
    const { result } = await run(prog);
    expect(result).toEqual({ ok: true, channel: "C123", ts: "1234567890.123456" });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/plugins/slack/7.14.0/interpreter.test.ts`
Expected: FAIL — module `src/plugins/slack/7.14.0/interpreter` does not exist

**Step 3: Write the interpreter**

Create `src/plugins/slack/7.14.0/interpreter.ts`. Follow the Stripe interpreter pattern exactly.

Define the `SlackClient` interface:
```ts
export interface SlackClient {
  apiCall(method: string, params?: Record<string, unknown>): Promise<unknown>;
}
```

The interpreter is a `const` (not a factory). For every node kind, the pattern is:
1. Recurse into `node.params` if non-null
2. Map the node kind to the Slack API method string (reverse of the naming: `slack/chat_postMessage` → `"chat.postMessage"`)
3. Yield one `slack/api_call` effect

Use a lookup map from node kind to Slack method string to keep the switch cases DRY:

```ts
const NODE_TO_METHOD: Record<string, string> = {
  "slack/chat_postMessage": "chat.postMessage",
  "slack/chat_update": "chat.update",
  // ... all 25
};
```

Then in `visit()`:
```ts
*visit(node) {
  const method = NODE_TO_METHOD[node.kind];
  if (!method) throw new Error(`Slack interpreter: unknown node kind "${node.kind}"`);

  const params = node.params != null
    ? yield { type: "recurse", child: node.params as ASTNode }
    : undefined;

  return yield {
    type: "slack/api_call",
    method,
    ...(params !== undefined ? { params } : {}),
  };
}
```

This is simpler than Stripe because every Slack method takes the same shape: `(params) => result`. No separate id/params pattern, no path interpolation.

**Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/plugins/slack/7.14.0/interpreter.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/plugins/slack/7.14.0/interpreter.ts tests/plugins/slack/7.14.0/interpreter.test.ts
git commit -m "feat(slack): add interpreter fragment with uniform slack/api_call effect (#56)"
```

---

### Task 3: Server Handler + SDK Adapter

**Files:**
- Create: `src/plugins/slack/7.14.0/handler.server.ts`
- Create: `src/plugins/slack/7.14.0/client-slack-web-api.ts`

**Step 1: Write `handler.server.ts`**

Follow `src/plugins/stripe/2025-04-30.basil/handler.server.ts` exactly.

```ts
import type { ASTNode, InterpreterFragment, StepHandler } from "../../../core";
import { runAST } from "../../../core";
import type { SlackClient } from "./interpreter";

export function serverHandler(client: SlackClient): StepHandler<void> {
  return async (effect, _context, state) => {
    if (effect.type === "slack/api_call") {
      const { method, params } = effect as {
        type: "slack/api_call";
        method: string;
        params?: Record<string, unknown>;
      };
      const value = await client.apiCall(method, params);
      return { value, state };
    }
    throw new Error(`serverHandler: unhandled effect type "${effect.type}"`);
  };
}

export function serverEvaluate(
  client: SlackClient,
  fragments: InterpreterFragment[],
): (root: ASTNode) => Promise<unknown> {
  return async (root: ASTNode): Promise<unknown> => {
    const { value } = await runAST(root, fragments, serverHandler(client), undefined);
    return value;
  };
}
```

**Step 2: Write `client-slack-web-api.ts`**

```ts
import type { WebClient } from "@slack/web-api";
import type { SlackClient } from "./interpreter";

export function wrapSlackWebClient(client: WebClient): SlackClient {
  return {
    async apiCall(method: string, params?: Record<string, unknown>): Promise<unknown> {
      return client.apiCall(method, params ?? {});
    },
  };
}
```

**Step 3: Verify it type-checks**

Run: `npm run build`
Expected: PASS (no type errors)

**Step 4: Commit**

```bash
git add src/plugins/slack/7.14.0/handler.server.ts src/plugins/slack/7.14.0/client-slack-web-api.ts
git commit -m "feat(slack): add server handler and SDK adapter (#56)"
```

---

### Task 4: Client Handler

**Files:**
- Create: `src/plugins/slack/7.14.0/handler.client.ts`

**Step 1: Write `handler.client.ts`**

This is identical to Stripe's client handler. Copy `src/plugins/stripe/2025-04-30.basil/handler.client.ts` and update the import path for core types. The client handler is plugin-agnostic — it serializes whatever effects it receives.

**Step 2: Verify it type-checks**

Run: `npm run build`
Expected: PASS

**Step 3: Commit**

```bash
git add src/plugins/slack/7.14.0/handler.client.ts
git commit -m "feat(slack): add client handler for browser-side execution (#56)"
```

---

### Task 5: Public Exports

**Files:**
- Modify: `src/index.ts` (add exports after the Stripe block, around line 93)

**Step 1: Add exports**

Add after the existing Stripe exports (after line 93) in `src/index.ts`:

```ts
// ---- Slack plugin (@slack/web-api 7.14.0) ----
export type { SlackConfig, SlackMethods } from "./plugins/slack/7.14.0";
export { slack } from "./plugins/slack/7.14.0";
export { wrapSlackWebClient } from "./plugins/slack/7.14.0/client-slack-web-api";
export type {
  ClientHandlerOptions as SlackClientHandlerOptions,
  ClientHandlerState as SlackClientHandlerState,
} from "./plugins/slack/7.14.0/handler.client";
export { clientHandler as slackClientHandler } from "./plugins/slack/7.14.0/handler.client";
export {
  serverEvaluate as slackServerEvaluate,
  serverHandler as slackServerHandler,
} from "./plugins/slack/7.14.0/handler.server";
export type { SlackClient } from "./plugins/slack/7.14.0/interpreter";
export { slackInterpreter } from "./plugins/slack/7.14.0/interpreter";
```

**Step 2: Verify build and existing tests still pass**

Run: `npm run build && npm run check && npm test -- --run`
Expected: All PASS. No regressions.

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat(slack): add public exports for slack plugin (#56)"
```

---

### Task 6: Integration Test

**Files:**
- Create: `tests/plugins/slack/7.14.0/integration.test.ts`

**Step 1: Write integration test**

Since there's no standard Slack mock container (unlike `stripe/stripe-mock`), the integration test uses a mock HTTP server that simulates Slack's `POST /api/{method}` endpoint pattern.

```ts
import http from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ilo } from "../../../../src/core";
import { coreInterpreter } from "../../../../src/interpreters/core";
import { error } from "../../../../src/plugins/error";
import { errorInterpreter } from "../../../../src/plugins/error/interpreter";
import { fiber } from "../../../../src/plugins/fiber";
import { fiberInterpreter } from "../../../../src/plugins/fiber/interpreter";
import { num } from "../../../../src/plugins/num";
import { numInterpreter } from "../../../../src/plugins/num/interpreter";
import { str } from "../../../../src/plugins/str";
import { strInterpreter } from "../../../../src/plugins/str/interpreter";
import { slack as slackPlugin } from "../../../../src/plugins/slack/7.14.0";
import { serverEvaluate } from "../../../../src/plugins/slack/7.14.0/handler.server";
import { slackInterpreter } from "../../../../src/plugins/slack/7.14.0/interpreter";
import type { SlackClient } from "../../../../src/plugins/slack/7.14.0/interpreter";

function injectInput(node: any, input: Record<string, unknown>): any {
  if (node === null || node === undefined || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map((n) => injectInput(n, input));
  const result: any = {};
  for (const [k, v] of Object.entries(node)) {
    result[k] = injectInput(v, input);
  }
  if (result.kind === "core/input") result.__inputData = input;
  return result;
}

// Mock Slack API server
let server: http.Server;
let port: number;
const callLog: Array<{ method: string; params: Record<string, unknown> }> = [];

const allFragments = [
  slackInterpreter,
  errorInterpreter,
  fiberInterpreter,
  coreInterpreter,
  numInterpreter,
  strInterpreter,
];

const app = ilo(num, str, slackPlugin({ token: "xoxb-test-token" }), fiber, error);

// Create a mock SlackClient that records calls
function createMockClient(): SlackClient {
  return {
    async apiCall(method: string, params?: Record<string, unknown>): Promise<unknown> {
      callLog.push({ method, params: params ?? {} });
      // Return realistic mock responses per method group
      if (method.startsWith("chat.")) {
        return { ok: true, channel: "C123", ts: "1234567890.123456", message: { text: params?.text } };
      }
      if (method.startsWith("conversations.list")) {
        return { ok: true, channels: [{ id: "C123", name: "general" }] };
      }
      if (method.startsWith("conversations.")) {
        return { ok: true, channel: { id: "C123", name: "general" } };
      }
      if (method.startsWith("users.lookupByEmail")) {
        return { ok: true, user: { id: "U123", name: "testuser" } };
      }
      if (method.startsWith("users.list")) {
        return { ok: true, members: [{ id: "U123", name: "testuser" }] };
      }
      if (method.startsWith("users.")) {
        return { ok: true, user: { id: "U123", name: "testuser" } };
      }
      if (method.startsWith("reactions.")) {
        return { ok: true };
      }
      if (method.startsWith("files.list")) {
        return { ok: true, files: [{ id: "F123", name: "test.txt" }] };
      }
      if (method.startsWith("files.")) {
        return { ok: true, file: { id: "F123", name: "test.txt" } };
      }
      return { ok: true };
    },
  };
}

async function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  callLog.length = 0;
  const ast = injectInput(prog.ast, input);
  const client = createMockClient();
  const evaluate = serverEvaluate(client, allFragments);
  return await evaluate(ast.result);
}

// ---- chat ----

describe("slack integration: chat", () => {
  it("postMessage returns message data", async () => {
    const prog = app(($) => $.slack.chat.postMessage({ channel: "#general", text: "Hello" }));
    const result = (await run(prog)) as any;
    expect(result.ok).toBe(true);
    expect(result.ts).toBeDefined();
  });

  it("update returns updated message", async () => {
    const prog = app(($) => $.slack.chat.update({ channel: "C123", ts: "123.456", text: "Updated" }));
    const result = (await run(prog)) as any;
    expect(result.ok).toBe(true);
  });
});

// ---- conversations ----

describe("slack integration: conversations", () => {
  it("list returns channels", async () => {
    const prog = app(($) => $.slack.conversations.list({ limit: 10 }));
    const result = (await run(prog)) as any;
    expect(result.ok).toBe(true);
    expect(Array.isArray(result.channels)).toBe(true);
  });

  it("info returns channel details", async () => {
    const prog = app(($) => $.slack.conversations.info({ channel: "C123" }));
    const result = (await run(prog)) as any;
    expect(result.ok).toBe(true);
    expect(result.channel).toBeDefined();
  });
});

// ---- users ----

describe("slack integration: users", () => {
  it("lookupByEmail returns user", async () => {
    const prog = app(($) => $.slack.users.lookupByEmail({ email: "user@example.com" }));
    const result = (await run(prog)) as any;
    expect(result.ok).toBe(true);
    expect(result.user.id).toBe("U123");
  });

  it("list returns members", async () => {
    const prog = app(($) => $.slack.users.list());
    const result = (await run(prog)) as any;
    expect(result.ok).toBe(true);
    expect(Array.isArray(result.members)).toBe(true);
  });
});

// ---- reactions ----

describe("slack integration: reactions", () => {
  it("add returns ok", async () => {
    const prog = app(($) => $.slack.reactions.add({ channel: "C123", timestamp: "123.456", name: "thumbsup" }));
    const result = (await run(prog)) as any;
    expect(result.ok).toBe(true);
  });
});

// ---- composition: error + slack ----

describe("composition: error + slack", () => {
  it("$.attempt wraps successful slack call", async () => {
    const prog = app(($) => $.attempt($.slack.chat.postMessage({ channel: "#general", text: "Attempt" })));
    const result = (await run(prog)) as any;
    expect(result.ok).not.toBeNull();
    expect(result.err).toBeNull();
  });
});

// ---- composition: fiber + slack ----

describe("composition: fiber + slack", () => {
  it("$.par runs two slack calls in parallel", async () => {
    const prog = app(($) =>
      $.par(
        $.slack.chat.postMessage({ channel: "#c1", text: "par1" }),
        $.slack.chat.postMessage({ channel: "#c2", text: "par2" }),
      ),
    );
    const result = (await run(prog)) as any[];
    expect(result).toHaveLength(2);
    expect(result[0].ok).toBe(true);
    expect(result[1].ok).toBe(true);
  });
});

// ---- chaining ----

describe("slack integration: chaining", () => {
  it("lookup user then send message with user id", async () => {
    const prog = app(($) => {
      const user = $.slack.users.lookupByEmail({ email: "chain@test.com" });
      return $.slack.chat.postMessage({
        channel: "#general",
        text: "Hello",
        user: (user as any).user.id,
      });
    });
    const result = (await run(prog)) as any;
    expect(result.ok).toBe(true);
    expect(callLog).toHaveLength(2);
    expect(callLog[0].method).toBe("users.lookupByEmail");
    expect(callLog[1].method).toBe("chat.postMessage");
  });
});
```

**Step 2: Run test**

Run: `npm test -- --run tests/plugins/slack/7.14.0/integration.test.ts`
Expected: All PASS

**Step 3: Commit**

```bash
git add tests/plugins/slack/7.14.0/integration.test.ts
git commit -m "feat(slack): add integration tests with mock client (#56)"
```

---

### Task 7: Final Validation

**Step 1: Run full test suite**

Run: `npm run build && npm run check && npm test -- --run`
Expected: All PASS, no type errors, no lint errors.

**Step 2: Verify all 25 node kinds are covered**

Manually verify that:
- `index.ts` nodeKinds array has exactly 25 entries
- `interpreter.ts` NODE_TO_METHOD map has exactly 25 entries
- `index.test.ts` covers all 25 kinds
- `interpreter.test.ts` covers representative methods from each group

**Step 3: Final commit (if any cleanup needed)**

If any adjustments were needed during validation, commit them.
