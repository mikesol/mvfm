import type { Program } from "@mvfm/core";
import {
  coreInterpreter,
  injectInput,
  mvfm,
  num,
  numInterpreter,
  str,
  strInterpreter,
} from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { twilio as twilioPlugin } from "../../src/5.5.1";
import { serverEvaluate } from "../../src/5.5.1/handler.server";
import type { TwilioClient } from "../../src/5.5.1/interpreter";
import { createTwilioInterpreter } from "../../src/5.5.1/interpreter";

const app = mvfm(num, str, twilioPlugin({ accountSid: "AC_test_123", authToken: "auth_test_456" }));

/**
 * Mock Twilio client that returns canned responses based on method/path.
 */
function createMockClient(): TwilioClient {
  return {
    async request(
      method: string,
      path: string,
      params?: Record<string, unknown>,
    ): Promise<unknown> {
      if (method === "POST" && path.includes("/Messages.json")) {
        return {
          sid: "SM_mock_123",
          status: "queued",
          to: params?.to ?? "+10000000000",
          from: params?.from ?? "+10000000001",
          body: params?.body ?? "",
        };
      }
      if (method === "GET" && path.includes("/Messages/")) {
        return { sid: "SM_mock_123", status: "delivered", body: "Hello" };
      }
      if (method === "GET" && path.includes("/Messages.json")) {
        return {
          messages: [
            { sid: "SM_1", status: "delivered" },
            { sid: "SM_2", status: "queued" },
          ],
        };
      }
      if (method === "POST" && path.includes("/Calls.json")) {
        return {
          sid: "CA_mock_456",
          status: "queued",
          to: params?.to ?? "+10000000000",
          from: params?.from ?? "+10000000001",
        };
      }
      if (method === "GET" && path.includes("/Calls/")) {
        return { sid: "CA_mock_456", status: "completed", duration: "42" };
      }
      if (method === "GET" && path.includes("/Calls.json")) {
        return {
          calls: [
            { sid: "CA_1", status: "completed" },
            { sid: "CA_2", status: "in-progress" },
          ],
        };
      }
      throw new Error(`Mock: unhandled ${method} ${path}`);
    },
  };
}

async function run(prog: Program, input: Record<string, unknown> = {}) {
  const injected = injectInput(prog, input);
  const client = createMockClient();
  const baseInterpreter = {
    ...createTwilioInterpreter(client),
    ...coreInterpreter,
    ...numInterpreter,
    ...strInterpreter,
  };
  const evaluate = serverEvaluate(client, baseInterpreter);
  return await evaluate(injected.ast.result);
}

// ============================================================
// Messages
// ============================================================

describe("twilio integration: messages", () => {
  it("create message", async () => {
    const prog = app(($) =>
      $.twilio.messages.create({ to: "+15551234567", from: "+15559876543", body: "Hello" }),
    );
    const result = (await run(prog)) as any;
    expect(result.sid).toBe("SM_mock_123");
    expect(result.status).toBe("queued");
  });

  it("fetch message", async () => {
    const prog = app(($) => $.twilio.messages("SM_mock_123").fetch());
    const result = (await run(prog)) as any;
    expect(result.sid).toBe("SM_mock_123");
    expect(result.status).toBe("delivered");
  });

  it("list messages", async () => {
    const prog = app(($) => $.twilio.messages.list({ limit: 10 }));
    const result = (await run(prog)) as any;
    expect(result.messages).toHaveLength(2);
  });
});

// ============================================================
// Calls
// ============================================================

describe("twilio integration: calls", () => {
  it("create call", async () => {
    const prog = app(($) =>
      $.twilio.calls.create({
        to: "+15551234567",
        from: "+15559876543",
        url: "https://example.com/twiml",
      }),
    );
    const result = (await run(prog)) as any;
    expect(result.sid).toBe("CA_mock_456");
    expect(result.status).toBe("queued");
  });

  it("fetch call", async () => {
    const prog = app(($) => $.twilio.calls("CA_mock_456").fetch());
    const result = (await run(prog)) as any;
    expect(result.sid).toBe("CA_mock_456");
    expect(result.status).toBe("completed");
  });

  it("list calls", async () => {
    const prog = app(($) => $.twilio.calls.list({ limit: 20 }));
    const result = (await run(prog)) as any;
    expect(result.calls).toHaveLength(2);
  });
});

// ============================================================
// Chaining
// ============================================================

describe("twilio integration: chaining", () => {
  it("create message then fetch it by sid", async () => {
    const prog = app(($) => {
      const msg = $.twilio.messages.create({
        to: "+15551234567",
        from: "+15559876543",
        body: "Chain test",
      });
      return $.twilio.messages((msg as any).sid).fetch();
    });
    const result = (await run(prog)) as any;
    // The fetch uses the mock sid from the create response
    expect(result.sid).toBeDefined();
  });
});
