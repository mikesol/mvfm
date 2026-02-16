import { describe, expect, it } from "vitest";
import { app, strip } from "./slack.shared";

describe("slack: chat.postMessage", () => {
  it("produces slack/chat_postMessage node", () => {
    const prog = app(($) => $.slack.chat.postMessage({ channel: "#general", text: "Hello" }));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/chat_postMessage");
    expect(ast.result.params.kind).toBe("core/record");
    expect(ast.result.params.fields.channel.value).toBe("#general");
    expect(ast.result.params.fields.text.value).toBe("Hello");
  });

  it("accepts Expr params", () => {
    const prog = app(($) =>
      $.slack.chat.postMessage({
        channel: $.input.channel,
        text: $.input.message,
      }),
    );
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("slack/chat_postMessage");
    expect(ast.result.params.fields.channel.kind).toBe("core/prop_access");
    expect(ast.result.params.fields.text.kind).toBe("core/prop_access");
  });
});

describe("slack: chat methods", () => {
  it("produces chat operation nodes", () => {
    expect(
      (
        strip(
          app(($) =>
            $.slack.chat.update({ channel: "C123", ts: "1234567890.123456", text: "Updated" }),
          ).ast,
        ) as any
      ).result.kind,
    ).toBe("slack/chat_update");
    expect(
      (
        strip(
          app(($) => $.slack.chat.delete({ channel: "C123", ts: "1234567890.123456" })).ast,
        ) as any
      ).result.kind,
    ).toBe("slack/chat_delete");
    expect(
      (
        strip(
          app(($) => $.slack.chat.postEphemeral({ channel: "C123", user: "U123", text: "Secret" }))
            .ast,
        ) as any
      ).result.kind,
    ).toBe("slack/chat_postEphemeral");
    expect(
      (
        strip(
          app(($) =>
            $.slack.chat.scheduleMessage({ channel: "C123", text: "Later", post_at: 1234567890 }),
          ).ast,
        ) as any
      ).result.kind,
    ).toBe("slack/chat_scheduleMessage");
    expect(
      (
        strip(
          app(($) =>
            $.slack.chat.getPermalink({ channel: "C123", message_ts: "1234567890.123456" }),
          ).ast,
        ) as any
      ).result.kind,
    ).toBe("slack/chat_getPermalink");
  });
});

describe("slack: conversations", () => {
  it("produces conversation operation nodes", () => {
    expect(
      (strip(app(($) => $.slack.conversations.list({ limit: 100 })).ast) as any).result.kind,
    ).toBe("slack/conversations_list");
    expect(
      (strip(app(($) => $.slack.conversations.info({ channel: "C123" })).ast) as any).result.kind,
    ).toBe("slack/conversations_info");
    expect(
      (strip(app(($) => $.slack.conversations.create({ name: "new-channel" })).ast) as any).result
        .kind,
    ).toBe("slack/conversations_create");
    expect(
      (
        strip(
          app(($) => $.slack.conversations.invite({ channel: "C123", users: "U123,U456" })).ast,
        ) as any
      ).result.kind,
    ).toBe("slack/conversations_invite");
    expect(
      (strip(app(($) => $.slack.conversations.history({ channel: "C123", limit: 50 })).ast) as any)
        .result.kind,
    ).toBe("slack/conversations_history");
    expect(
      (strip(app(($) => $.slack.conversations.members({ channel: "C123" })).ast) as any).result
        .kind,
    ).toBe("slack/conversations_members");
    expect(
      (strip(app(($) => $.slack.conversations.open({ users: "U123,U456" })).ast) as any).result
        .kind,
    ).toBe("slack/conversations_open");
    expect(
      (
        strip(
          app(($) => $.slack.conversations.replies({ channel: "C123", ts: "1234567890.123456" }))
            .ast,
        ) as any
      ).result.kind,
    ).toBe("slack/conversations_replies");
  });

  it("stores null for omitted optional params", () => {
    const ast = strip(app(($) => $.slack.conversations.list()).ast) as any;
    expect(ast.result.kind).toBe("slack/conversations_list");
    expect(ast.result.params).toBeNull();
  });
});
