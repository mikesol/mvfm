import { describe, expect, it } from "vitest";
import { ilo } from "../../../../src/core";
import { coreInterpreter } from "../../../../src/interpreters/core";
import { error } from "../../../../src/plugins/error";
import { errorInterpreter } from "../../../../src/plugins/error/interpreter";
import { fiber } from "../../../../src/plugins/fiber";
import { fiberInterpreter } from "../../../../src/plugins/fiber/interpreter";
import { num } from "../../../../src/plugins/num";
import { numInterpreter } from "../../../../src/plugins/num/interpreter";
import { slack as slackPlugin } from "../../../../src/plugins/slack/7.14.0";
import { serverEvaluate } from "../../../../src/plugins/slack/7.14.0/handler.server";
import type { SlackClient } from "../../../../src/plugins/slack/7.14.0/interpreter";
import { slackInterpreter } from "../../../../src/plugins/slack/7.14.0/interpreter";
import { str } from "../../../../src/plugins/str";
import { strInterpreter } from "../../../../src/plugins/str/interpreter";

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
        return {
          ok: true,
          channel: "C123",
          ts: "1234567890.123456",
          message: { text: params?.text },
        };
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
    const prog = app(($) =>
      $.slack.chat.update({ channel: "C123", ts: "123.456", text: "Updated" }),
    );
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
    const prog = app(($) =>
      $.slack.reactions.add({ channel: "C123", timestamp: "123.456", name: "thumbsup" }),
    );
    const result = (await run(prog)) as any;
    expect(result.ok).toBe(true);
  });
});

// ---- composition: error + slack ----

describe("composition: error + slack", () => {
  it("$.attempt wraps successful slack call", async () => {
    const prog = app(($) =>
      $.attempt($.slack.chat.postMessage({ channel: "#general", text: "Attempt" })),
    );
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
