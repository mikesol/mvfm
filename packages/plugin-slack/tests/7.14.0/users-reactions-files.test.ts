import { describe, expect, it } from "vitest";
import { $ } from "./slack.shared";

describe("slack: users", () => {
  it("produces users operation CExprs", () => {
    expect($.slack.users.info({ user: "U123" }).__kind).toBe("slack/users_info");
    expect($.slack.users.list({ limit: 200 }).__kind).toBe("slack/users_list");
    expect($.slack.users.lookupByEmail({ email: "user@example.com" }).__kind).toBe(
      "slack/users_lookupByEmail",
    );
    expect($.slack.users.conversations({ user: "U123" }).__kind).toBe("slack/users_conversations");
  });

  it("produces CExpr with no args when users.list params omitted", () => {
    const expr = ($.slack.users as any).list();
    expect(expr.__kind).toBe("slack/users_list");
    expect(expr.__args).toHaveLength(0);
  });
});

describe("slack: reactions", () => {
  it("produces reactions operation CExprs", () => {
    expect(
      $.slack.reactions.add({
        channel: "C123",
        timestamp: "1234567890.123456",
        name: "thumbsup",
      }).__kind,
    ).toBe("slack/reactions_add");
    expect($.slack.reactions.get({ channel: "C123", timestamp: "1234567890.123456" }).__kind).toBe(
      "slack/reactions_get",
    );
    expect(
      $.slack.reactions.remove({
        channel: "C123",
        timestamp: "1234567890.123456",
        name: "thumbsup",
      }).__kind,
    ).toBe("slack/reactions_remove");
  });

  it("produces CExpr with no args when reactions.list params omitted", () => {
    const expr = $.slack.reactions.list();
    expect(expr.__kind).toBe("slack/reactions_list");
    expect(expr.__args).toHaveLength(0);
  });
});

describe("slack: files", () => {
  it("produces file operation CExprs", () => {
    expect($.slack.files.list({ channel: "C123" }).__kind).toBe("slack/files_list");
    expect($.slack.files.info({ file: "F123" }).__kind).toBe("slack/files_info");
    expect($.slack.files.delete({ file: "F123" }).__kind).toBe("slack/files_delete");
  });

  it("produces CExpr with no args when files.list params omitted", () => {
    const expr = ($.slack.files as any).list();
    expect(expr.__kind).toBe("slack/files_list");
    expect(expr.__args).toHaveLength(0);
  });
});
