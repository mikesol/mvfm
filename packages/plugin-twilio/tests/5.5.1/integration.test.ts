import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { boolPluginU, createApp, defaults, fold, mvfmU, numPluginU, strPluginU } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { twilio } from "../../src/5.5.1";
import { createTwilioInterpreter } from "../../src/5.5.1/interpreter";
import { createFixtureClient } from "./fixture-client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureClient = createFixtureClient(join(__dirname, "fixtures"));
const plugin = twilio({
  accountSid: "AC_test_123",
  authToken: "auth_test_456",
});
const plugins = [numPluginU, strPluginU, boolPluginU, plugin] as const;
const $ = mvfmU(...plugins);
const app = createApp(...plugins);

async function run(expr: unknown) {
  const nexpr = app(expr as Parameters<typeof app>[0]);
  const interp = defaults(plugins, {
    twilio: createTwilioInterpreter(fixtureClient, "AC_test_123"),
  });
  return await fold(nexpr, interp);
}

// ============================================================
// Messages
// ============================================================

describe("twilio integration: messages", () => {
  it("create message", async () => {
    const expr = $.twilio.messages.create({
      to: "+15551234567",
      from: "+15559876543",
      body: "Hello",
    });
    const result = (await run(expr)) as Record<string, unknown>;
    expect(result.sid).toMatch(/^SM/);
    expect(result.status).toBe("queued");
    expect(result.to).toBe("+15551234567");
    expect(result.from).toBe("+15559876543");
    expect(result.body).toBe("Hello");
    expect(result.direction).toBe("outbound-api");
  });

  it("fetch message", async () => {
    const expr = $.twilio.messages("SM00000000000000000000000000000001").fetch();
    const result = (await run(expr)) as Record<string, unknown>;
    expect(result.sid).toMatch(/^SM/);
    expect(result.status).toBe("delivered");
    expect(result.body).toBe("Hello");
  });

  it("list messages", async () => {
    const expr = $.twilio.messages.list({ limit: 10 });
    const result = (await run(expr)) as Record<string, unknown>;
    expect(result.messages as Array<Record<string, unknown>>).toHaveLength(2);
    expect((result.messages as Array<Record<string, unknown>>)[0].sid).toMatch(/^SM/);
  });
});

// ============================================================
// Calls
// ============================================================

describe("twilio integration: calls", () => {
  it("create call", async () => {
    const expr = $.twilio.calls.create({
      to: "+15551234567",
      from: "+15559876543",
      url: "https://example.com/twiml",
    });
    const result = (await run(expr)) as Record<string, unknown>;
    expect(result.sid).toMatch(/^CA/);
    expect(result.status).toBe("queued");
    expect(result.to).toBe("+15551234567");
  });

  it("fetch call", async () => {
    const expr = $.twilio.calls("CA00000000000000000000000000000001").fetch();
    const result = (await run(expr)) as Record<string, unknown>;
    expect(result.sid).toMatch(/^CA/);
    expect(result.status).toBe("completed");
    expect(result.duration).toBe("42");
  });

  it("list calls", async () => {
    const expr = $.twilio.calls.list({ limit: 20 });
    const result = (await run(expr)) as Record<string, unknown>;
    expect(result.calls as Array<Record<string, unknown>>).toHaveLength(2);
    expect((result.calls as Array<Record<string, unknown>>)[0].sid).toMatch(/^CA/);
  });
});

// ============================================================
// Chaining
// ============================================================

describe("twilio integration: chaining", () => {
  it("create message then fetch it by sid", async () => {
    const expr = $.twilio.messages("SM00000000000000000000000000000001").fetch();
    const result = (await run(expr)) as Record<string, unknown>;
    expect(result.sid).toBeDefined();
    expect(result.status).toBe("delivered");
  });
});
