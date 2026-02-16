import type { Program } from "@mvfm/core";
import { coreInterpreter, foldAST, injectInput, mvfm, num, str } from "@mvfm/core";
import { describe, expect, it, vi } from "vitest";
import { slackInterpreter } from "../../src";
import { slack } from "../../src/7.14.0";
import { createSlackInterpreter, type SlackClient } from "../../src/7.14.0/interpreter";

const app = mvfm(num, str, slack({ token: "xoxb-test-token" }));

describe("slack interpreter: default export", () => {
  it("throws when SLACK_BOT_TOKEN is missing", async () => {
    vi.stubEnv("SLACK_BOT_TOKEN", "");
    const prog = app(($) => $.slack.chat.postMessage({ channel: "#general", text: "Hello" }));
    const combined = { ...slackInterpreter, ...coreInterpreter };
    await expect(foldAST(combined, prog.ast.result)).rejects.toThrow(/SLACK_BOT_TOKEN/);
    vi.unstubAllEnvs();
  });

  it("exports a default ready-to-use interpreter when SLACK_BOT_TOKEN is set", () => {
    vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test-default");
    expect(typeof slackInterpreter["slack/chat_postMessage"]).toBe("function");
    vi.unstubAllEnvs();
  });
});

async function run(prog: Program, input: Record<string, unknown> = {}) {
  const captured: Array<{ method: string; params?: Record<string, unknown> }> = [];
  const injected = injectInput(prog, input);
  const mockClient: SlackClient = {
    async apiCall(method: string, params?: Record<string, unknown>) {
      captured.push({ method, params });
      return { ok: true, channel: "C123", ts: "1234567890.123456" };
    },
  };
  const combined = { ...createSlackInterpreter(mockClient), ...coreInterpreter };
  const result = await foldAST(combined, injected);
  return { result, captured };
}

// ---- chat ----

describe("slack interpreter: chat_postMessage", () => {
  it("yields slack/api_call with chat.postMessage method", async () => {
    const prog = app(($) => $.slack.chat.postMessage({ channel: "#general", text: "Hello" }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("chat.postMessage");
    expect(captured[0].params).toEqual({ channel: "#general", text: "Hello" });
  });
});

describe("slack interpreter: chat_update", () => {
  it("yields slack/api_call with chat.update method", async () => {
    const prog = app(($) =>
      $.slack.chat.update({ channel: "C123", ts: "123.456", text: "Updated" }),
    );
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
    const prog = app(($) =>
      $.slack.chat.postEphemeral({ channel: "C123", user: "U123", text: "Shhh" }),
    );
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("chat.postEphemeral");
  });
});

describe("slack interpreter: chat_scheduleMessage", () => {
  it("yields slack/api_call with chat.scheduleMessage method", async () => {
    const prog = app(($) =>
      $.slack.chat.scheduleMessage({ channel: "C123", text: "Later", post_at: 9999999999 }),
    );
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
    const prog = app(($) =>
      $.slack.reactions.add({ channel: "C123", timestamp: "123.456", name: "thumbsup" }),
    );
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
