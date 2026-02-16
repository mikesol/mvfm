import { describe, expect, it } from "vitest";
import { app, strip } from "./slack.shared";

describe("slack: integration with $.begin()", () => {
  it("side-effecting operations wrapped in $.begin() are reachable", () => {
    expect(() => {
      app(($) => {
        const msg = $.slack.chat.postMessage({ channel: "#general", text: "Hello" });
        const reaction = $.slack.reactions.add({
          channel: "#general",
          timestamp: (msg as any).ts,
          name: "thumbsup",
        });
        return $.begin(msg, reaction);
      });
    }).not.toThrow();
  });

  it("orphaned operations are rejected", () => {
    expect(() => {
      app(($) => {
        const info = $.slack.conversations.info({ channel: "C123" });
        $.slack.chat.postMessage({ channel: "C123", text: "orphan!" });
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
      return $.begin(user, msg);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("core/begin");
  });
});
