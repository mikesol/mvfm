import { defaults, fold } from "@mvfm/core";
import { describe, expect, it, vi } from "vitest";
import { slackInterpreter } from "../../src";
import { createSlackInterpreter, type SlackClient } from "../../src/7.14.0/generated/interpreter";
import { $, app, plugins } from "./slack.shared";

async function run(expr: unknown) {
  const captured: Array<{ method: string; params?: Record<string, unknown> }> = [];
  const mockClient: SlackClient = {
    async apiCall(method: string, params?: Record<string, unknown>) {
      captured.push({ method, params });
      return { ok: true, channel: "C123", ts: "1234567890.123456" };
    },
  };
  const nexpr = app(expr as Parameters<typeof app>[0]);
  const interp = defaults(plugins, { slack: createSlackInterpreter(mockClient) });
  const result = await fold(nexpr, interp);
  return { result, captured };
}

describe("slack interpreter: default export", () => {
  it("throws when SLACK_BOT_TOKEN is missing", async () => {
    vi.stubEnv("SLACK_BOT_TOKEN", "");
    const expr = $.slack.chat.postMessage({ channel: "#general", text: "Hello" });
    const nexpr = app(expr as Parameters<typeof app>[0]);
    const stdInterp = defaults(plugins.slice(0, 3) as any);
    const combined = { ...stdInterp, ...slackInterpreter };
    await expect(fold(nexpr, combined)).rejects.toThrow(/SLACK_BOT_TOKEN/);
    vi.unstubAllEnvs();
  });

  it("exports a default ready-to-use interpreter when SLACK_BOT_TOKEN is set", () => {
    vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test-default");
    expect(typeof slackInterpreter["slack/chat_postMessage"]).toBe("function");
    vi.unstubAllEnvs();
  });
});

// ---- chat ----

describe("slack interpreter: chat_postMessage", () => {
  it("yields slack/api_call with chat.postMessage method", async () => {
    const expr = $.slack.chat.postMessage({ channel: "#general", text: "Hello" });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("chat.postMessage");
    expect(captured[0].params).toEqual({ channel: "#general", text: "Hello" });
  });
});

describe("slack interpreter: chat_update", () => {
  it("yields slack/api_call with chat.update method", async () => {
    const expr = $.slack.chat.update({ channel: "C123", ts: "123.456", text: "Updated" });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("chat.update");
    expect(captured[0].params).toEqual({ channel: "C123", ts: "123.456", text: "Updated" });
  });
});

describe("slack interpreter: chat_delete", () => {
  it("yields slack/api_call with chat.delete method", async () => {
    const expr = $.slack.chat.delete({ channel: "C123", ts: "123.456" });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("chat.delete");
  });
});

describe("slack interpreter: chat_postEphemeral", () => {
  it("yields slack/api_call with chat.postEphemeral method", async () => {
    const expr = $.slack.chat.postEphemeral({ channel: "C123", user: "U123", text: "Shhh" });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("chat.postEphemeral");
  });
});

describe("slack interpreter: chat_scheduleMessage", () => {
  it("yields slack/api_call with chat.scheduleMessage method", async () => {
    const expr = $.slack.chat.scheduleMessage({
      channel: "C123",
      text: "Later",
      post_at: 9999999999,
    });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("chat.scheduleMessage");
  });
});

describe("slack interpreter: chat_getPermalink", () => {
  it("yields slack/api_call with chat.getPermalink method", async () => {
    const expr = $.slack.chat.getPermalink({ channel: "C123", message_ts: "123.456" });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("chat.getPermalink");
  });
});

// ---- conversations ----

describe("slack interpreter: conversations_list", () => {
  it("yields slack/api_call with conversations.list method", async () => {
    const expr = $.slack.conversations.list({ limit: 100 });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("conversations.list");
    expect(captured[0].params).toEqual({ limit: 100 });
  });

  it("yields with undefined params when omitted", async () => {
    const expr = $.slack.conversations.list();
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("conversations.list");
    expect(captured[0].params).toBeUndefined();
  });
});

describe("slack interpreter: conversations_info", () => {
  it("yields slack/api_call with conversations.info method", async () => {
    const expr = $.slack.conversations.info({ channel: "C123" });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("conversations.info");
  });
});

describe("slack interpreter: conversations_history", () => {
  it("yields slack/api_call with conversations.history method", async () => {
    const expr = $.slack.conversations.history({ channel: "C123", limit: 50 });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("conversations.history");
  });
});

// ---- users ----

describe("slack interpreter: users_info", () => {
  it("yields slack/api_call with users.info method", async () => {
    const expr = $.slack.users.info({ user: "U123" });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("users.info");
  });
});

describe("slack interpreter: users_lookupByEmail", () => {
  it("yields slack/api_call with users.lookupByEmail method", async () => {
    const expr = $.slack.users.lookupByEmail({ email: "user@example.com" });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("users.lookupByEmail");
  });
});

// ---- reactions ----

describe("slack interpreter: reactions_add", () => {
  it("yields slack/api_call with reactions.add method", async () => {
    const expr = $.slack.reactions.add({
      channel: "C123",
      timestamp: "123.456",
      name: "thumbsup",
    });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("reactions.add");
  });
});

describe("slack interpreter: reactions_list", () => {
  it("yields with undefined params when omitted", async () => {
    const expr = $.slack.reactions.list();
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("reactions.list");
    expect(captured[0].params).toBeUndefined();
  });
});

// ---- files ----

describe("slack interpreter: files_list", () => {
  it("yields slack/api_call with files.list method", async () => {
    const expr = $.slack.files.list({ channel: "C123" });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("files.list");
  });
});

describe("slack interpreter: files_info", () => {
  it("yields slack/api_call with files.info method", async () => {
    const expr = $.slack.files.info({ file: "F123" });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("files.info");
  });
});

describe("slack interpreter: files_delete", () => {
  it("yields slack/api_call with files.delete method", async () => {
    const expr = $.slack.files.delete({ file: "F123" });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("files.delete");
  });
});

// ---- return value ----

describe("slack interpreter: return value", () => {
  it("returns the handler response as the result", async () => {
    const expr = $.slack.chat.postMessage({ channel: "#general", text: "Hi" });
    const { result } = await run(expr);
    expect(result).toEqual({ ok: true, channel: "C123", ts: "1234567890.123456" });
  });
});
