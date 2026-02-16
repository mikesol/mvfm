import { describe, expect, it } from "vitest";
import { app, strip } from "./slack.shared";

describe("slack: users", () => {
  it("produces users operation nodes", () => {
    expect((strip(app(($) => $.slack.users.info({ user: "U123" })).ast) as any).result.kind).toBe(
      "slack/users_info",
    );
    expect((strip(app(($) => $.slack.users.list({ limit: 200 })).ast) as any).result.kind).toBe(
      "slack/users_list",
    );
    expect(
      (strip(app(($) => $.slack.users.lookupByEmail({ email: "user@example.com" })).ast) as any)
        .result.kind,
    ).toBe("slack/users_lookupByEmail");
    expect(
      (strip(app(($) => $.slack.users.conversations({ user: "U123" })).ast) as any).result.kind,
    ).toBe("slack/users_conversations");
  });

  it("stores null for omitted users.list params", () => {
    const ast = strip(app(($) => $.slack.users.list()).ast) as any;
    expect(ast.result.kind).toBe("slack/users_list");
    expect(ast.result.params).toBeNull();
  });
});

describe("slack: reactions", () => {
  it("produces reactions operation nodes", () => {
    expect(
      (
        strip(
          app(($) =>
            $.slack.reactions.add({
              channel: "C123",
              timestamp: "1234567890.123456",
              name: "thumbsup",
            }),
          ).ast,
        ) as any
      ).result.kind,
    ).toBe("slack/reactions_add");
    expect(
      (
        strip(
          app(($) => $.slack.reactions.get({ channel: "C123", timestamp: "1234567890.123456" }))
            .ast,
        ) as any
      ).result.kind,
    ).toBe("slack/reactions_get");
    expect(
      (
        strip(
          app(($) =>
            $.slack.reactions.remove({
              channel: "C123",
              timestamp: "1234567890.123456",
              name: "thumbsup",
            }),
          ).ast,
        ) as any
      ).result.kind,
    ).toBe("slack/reactions_remove");
  });

  it("stores null for omitted reactions.list params", () => {
    const ast = strip(app(($) => $.slack.reactions.list()).ast) as any;
    expect(ast.result.kind).toBe("slack/reactions_list");
    expect(ast.result.params).toBeNull();
  });
});

describe("slack: files", () => {
  it("produces file operation nodes", () => {
    expect(
      (strip(app(($) => $.slack.files.list({ channel: "C123" })).ast) as any).result.kind,
    ).toBe("slack/files_list");
    expect((strip(app(($) => $.slack.files.info({ file: "F123" })).ast) as any).result.kind).toBe(
      "slack/files_info",
    );
    expect((strip(app(($) => $.slack.files.delete({ file: "F123" })).ast) as any).result.kind).toBe(
      "slack/files_delete",
    );
  });

  it("stores null for omitted files.list params", () => {
    const ast = strip(app(($) => $.slack.files.list()).ast) as any;
    expect(ast.result.kind).toBe("slack/files_list");
    expect(ast.result.params).toBeNull();
  });
});
