import { describe, expect, it } from "vitest";
import { $, app } from "./slack.shared";

describe("slack: chat.postMessage", () => {
  it("produces slack/chat_postMessage CExpr", () => {
    const expr = $.slack.chat.postMessage({ channel: "#general", text: "Hello" });
    expect(expr.__kind).toBe("slack/chat_postMessage");
    expect(expr.__args).toHaveLength(1);
    const paramsArg = expr.__args[0] as { __kind: string };
    expect(paramsArg.__kind).toBe("slack/record");
  });

  it("accepts CExpr params", () => {
    const expr = $.slack.chat.postMessage({
      channel: $.slack.conversations.info({ channel: "C123" }).channel,
      text: "Hello",
    });
    expect(expr.__kind).toBe("slack/chat_postMessage");
    const paramsArg = expr.__args[0] as { __kind: string; __args: unknown[] };
    expect(paramsArg.__kind).toBe("slack/record");
  });

  it("elaborates without error", () => {
    const expr = $.slack.chat.postMessage({ channel: "#general", text: "Hello" });
    expect(() => app(expr as Parameters<typeof app>[0])).not.toThrow();
  });
});

describe("slack: chat methods", () => {
  it("produces chat operation CExprs", () => {
    expect(
      $.slack.chat.update({ channel: "C123", ts: "1234567890.123456", text: "Updated" }).__kind,
    ).toBe("slack/chat_update");
    expect($.slack.chat.delete({ channel: "C123", ts: "1234567890.123456" }).__kind).toBe(
      "slack/chat_delete",
    );
    expect(
      $.slack.chat.postEphemeral({ channel: "C123", user: "U123", text: "Secret" }).__kind,
    ).toBe("slack/chat_postEphemeral");
    expect(
      $.slack.chat.scheduleMessage({ channel: "C123", text: "Later", post_at: 1234567890 }).__kind,
    ).toBe("slack/chat_scheduleMessage");
    expect(
      $.slack.chat.getPermalink({ channel: "C123", message_ts: "1234567890.123456" }).__kind,
    ).toBe("slack/chat_getPermalink");
  });
});

describe("slack: conversations", () => {
  it("produces conversation operation CExprs", () => {
    expect($.slack.conversations.list({ limit: 100 }).__kind).toBe("slack/conversations_list");
    expect($.slack.conversations.info({ channel: "C123" }).__kind).toBe("slack/conversations_info");
    expect($.slack.conversations.create({ name: "new-channel" }).__kind).toBe(
      "slack/conversations_create",
    );
    expect($.slack.conversations.invite({ channel: "C123", users: "U123,U456" }).__kind).toBe(
      "slack/conversations_invite",
    );
    expect($.slack.conversations.history({ channel: "C123", limit: 50 }).__kind).toBe(
      "slack/conversations_history",
    );
    expect($.slack.conversations.members({ channel: "C123" }).__kind).toBe(
      "slack/conversations_members",
    );
    expect($.slack.conversations.open({ users: "U123,U456" }).__kind).toBe(
      "slack/conversations_open",
    );
    expect($.slack.conversations.replies({ channel: "C123", ts: "1234567890.123456" }).__kind).toBe(
      "slack/conversations_replies",
    );
  });

  it("produces CExpr with no args when params omitted", () => {
    const expr = $.slack.conversations.list();
    expect(expr.__kind).toBe("slack/conversations_list");
    expect(expr.__args).toHaveLength(0);
  });
});
