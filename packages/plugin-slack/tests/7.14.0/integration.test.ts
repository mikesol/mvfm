import { defaults, fold } from "@mvfm/core";
import { describe, expect, it } from "vitest";
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

describe("slack: cross-operation dependencies", () => {
  it("can construct expressions that reference other expressions", () => {
    const user = $.slack.users.lookupByEmail({ email: "user@example.com" });
    const msg = $.slack.chat.postMessage({
      channel: "#general",
      text: "Hello",
      user: (user as any).user.id,
    });
    expect(msg.__kind).toBe("slack/chat_postMessage");
  });
});

describe("slack: end-to-end fold", () => {
  it("folds a simple chat.postMessage", async () => {
    const expr = $.slack.chat.postMessage({ channel: "#general", text: "Hello" });
    const { result, captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("chat.postMessage");
    expect(captured[0].params).toEqual({ channel: "#general", text: "Hello" });
    expect(result).toEqual({ ok: true, channel: "C123", ts: "1234567890.123456" });
  });
});
