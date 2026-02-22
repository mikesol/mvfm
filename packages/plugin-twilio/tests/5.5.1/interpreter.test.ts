import { boolPluginU, createApp, defaults, fold, mvfmU, numPluginU, strPluginU } from "@mvfm/core";
import { describe, expect, it, vi } from "vitest";
import { twilioInterpreter } from "../../src";
import { twilio } from "../../src/5.5.1";
import { createTwilioInterpreter, type TwilioClient } from "../../src/5.5.1/interpreter";

const plugin = twilio({
  accountSid: "AC_test_123",
  authToken: "auth_test_456",
});
const plugins = [numPluginU, strPluginU, boolPluginU, plugin] as const;
const $ = mvfmU(...plugins);
const app = createApp(...plugins);

async function run(expr: unknown) {
  const captured: Array<{
    method: string;
    path: string;
    params?: Record<string, unknown>;
  }> = [];
  const mockClient: TwilioClient = {
    async request(method, path, params) {
      captured.push({ method, path, params });
      return { sid: "mock_sid", status: "mock" };
    },
  };
  const nexpr = app(expr as Parameters<typeof app>[0]);
  const interp = defaults(plugins, {
    twilio: createTwilioInterpreter(mockClient, "AC_test_123"),
  });
  const result = await fold(nexpr, interp);
  return { result, captured };
}

// ============================================================
// Default interpreter
// ============================================================

describe("twilio interpreter: default export", () => {
  it("throws when TWILIO_ACCOUNT_SID is missing", async () => {
    vi.stubEnv("TWILIO_ACCOUNT_SID", "");
    vi.stubEnv("TWILIO_AUTH_TOKEN", "auth_test_default");
    const expr = $.twilio.messages.create({
      to: "+15551234567",
      from: "+15559876543",
      body: "Hello",
    });
    const nexpr = app(expr as Parameters<typeof app>[0]);
    const stdInterp = defaults([numPluginU, strPluginU, boolPluginU]);
    const combined = { ...stdInterp, ...twilioInterpreter };
    await expect(fold(nexpr, combined)).rejects.toThrow(/TWILIO_ACCOUNT_SID/);
    vi.unstubAllEnvs();
  });

  it("throws when TWILIO_AUTH_TOKEN is missing", async () => {
    vi.stubEnv("TWILIO_ACCOUNT_SID", "AC_test_default");
    vi.stubEnv("TWILIO_AUTH_TOKEN", "");
    const expr = $.twilio.messages.create({
      to: "+15551234567",
      from: "+15559876543",
      body: "Hello",
    });
    const nexpr = app(expr as Parameters<typeof app>[0]);
    const stdInterp = defaults([numPluginU, strPluginU, boolPluginU]);
    const combined = { ...stdInterp, ...twilioInterpreter };
    await expect(fold(nexpr, combined)).rejects.toThrow(/TWILIO_AUTH_TOKEN/);
    vi.unstubAllEnvs();
  });

  it("exports a default ready-to-use interpreter when env vars set", () => {
    vi.stubEnv("TWILIO_ACCOUNT_SID", "AC_test_default");
    vi.stubEnv("TWILIO_AUTH_TOKEN", "auth_test_default");
    expect(typeof twilioInterpreter["twilio/create_message"]).toBe("function");
    vi.unstubAllEnvs();
  });
});

// ============================================================
// Messages
// ============================================================

describe("twilio interpreter: create_message", () => {
  it("yields POST to Messages.json with correct params", async () => {
    const expr = $.twilio.messages.create({
      to: "+15551234567",
      from: "+15559876543",
      body: "Hello",
    });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/2010-04-01/Accounts/AC_test_123/Messages.json");
    expect(captured[0].params).toEqual({
      to: "+15551234567",
      from: "+15559876543",
      body: "Hello",
    });
  });
});

describe("twilio interpreter: fetch_message", () => {
  it("yields GET to Messages/{Sid}.json", async () => {
    const expr = $.twilio.messages("SM800f449d").fetch();
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/2010-04-01/Accounts/AC_test_123/Messages/SM800f449d.json");
    expect(captured[0].params).toBeUndefined();
  });
});

describe("twilio interpreter: list_messages", () => {
  it("yields GET to Messages.json with params", async () => {
    const expr = $.twilio.messages.list({ limit: 10 });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/2010-04-01/Accounts/AC_test_123/Messages.json");
    expect(captured[0].params).toEqual({ limit: 10 });
  });

  it("yields GET with undefined params when omitted", async () => {
    const expr = $.twilio.messages.list();
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/2010-04-01/Accounts/AC_test_123/Messages.json");
    expect(captured[0].params).toBeUndefined();
  });
});

// ============================================================
// Calls
// ============================================================

describe("twilio interpreter: create_call", () => {
  it("yields POST to Calls.json with correct params", async () => {
    const expr = $.twilio.calls.create({
      to: "+15551234567",
      from: "+15559876543",
      url: "https://example.com/twiml",
    });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/2010-04-01/Accounts/AC_test_123/Calls.json");
    expect(captured[0].params).toEqual({
      to: "+15551234567",
      from: "+15559876543",
      url: "https://example.com/twiml",
    });
  });
});

describe("twilio interpreter: fetch_call", () => {
  it("yields GET to Calls/{Sid}.json", async () => {
    const expr = $.twilio.calls("CA42ed11f9").fetch();
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/2010-04-01/Accounts/AC_test_123/Calls/CA42ed11f9.json");
    expect(captured[0].params).toBeUndefined();
  });
});

describe("twilio interpreter: list_calls", () => {
  it("yields GET to Calls.json with params", async () => {
    const expr = $.twilio.calls.list({ limit: 20 });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/2010-04-01/Accounts/AC_test_123/Calls.json");
    expect(captured[0].params).toEqual({ limit: 20 });
  });

  it("yields GET with undefined params when omitted", async () => {
    const expr = $.twilio.calls.list();
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/2010-04-01/Accounts/AC_test_123/Calls.json");
    expect(captured[0].params).toBeUndefined();
  });
});

// ============================================================
// Return value
// ============================================================

describe("twilio interpreter: return value", () => {
  it("returns the handler response as the result", async () => {
    const expr = $.twilio.messages("SM_123").fetch();
    const { result } = await run(expr);
    expect(result).toEqual({ sid: "mock_sid", status: "mock" });
  });
});
