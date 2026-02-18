import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Program } from "@mvfm/core";
import {
  coreInterpreter,
  foldAST,
  injectInput,
  mvfm,
  num,
  numInterpreter,
  str,
  strInterpreter,
} from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { twilio as twilioPlugin } from "../../src/5.5.1";
import { createTwilioInterpreter } from "../../src/5.5.1/interpreter";
import { createFixtureClient } from "./fixture-client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureClient = createFixtureClient(join(__dirname, "fixtures"));
const app = mvfm(num, str, twilioPlugin({ accountSid: "AC_test_123", authToken: "auth_test_456" }));

async function run(prog: Program) {
  const injected = injectInput(prog, {});
  const combined = {
    ...createTwilioInterpreter(fixtureClient),
    ...coreInterpreter,
    ...numInterpreter,
    ...strInterpreter,
  };
  return await foldAST(combined, injected);
}

// ============================================================
// Messages
// ============================================================

describe("twilio integration: messages", () => {
  it("create message", async () => {
    const prog = app(($) =>
      $.twilio.messages.create({
        to: "+15551234567",
        from: "+15559876543",
        body: "Hello",
      }),
    );
    const result = (await run(prog)) as any;
    expect(result.sid).toMatch(/^SM/);
    expect(result.status).toBe("queued");
    expect(result.to).toBe("+15551234567");
    expect(result.from).toBe("+15559876543");
    expect(result.body).toBe("Hello");
    expect(result.direction).toBe("outbound-api");
  });

  it("fetch message", async () => {
    const prog = app(($) => $.twilio.messages("SM00000000000000000000000000000001").fetch());
    const result = (await run(prog)) as any;
    expect(result.sid).toMatch(/^SM/);
    expect(result.status).toBe("delivered");
    expect(result.body).toBe("Hello");
  });

  it("list messages", async () => {
    const prog = app(($) => $.twilio.messages.list({ limit: 10 }));
    const result = (await run(prog)) as any;
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].sid).toMatch(/^SM/);
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
    expect(result.sid).toMatch(/^CA/);
    expect(result.status).toBe("queued");
    expect(result.to).toBe("+15551234567");
  });

  it("fetch call", async () => {
    const prog = app(($) => $.twilio.calls("CA00000000000000000000000000000001").fetch());
    const result = (await run(prog)) as any;
    expect(result.sid).toMatch(/^CA/);
    expect(result.status).toBe("completed");
    expect(result.duration).toBe("42");
  });

  it("list calls", async () => {
    const prog = app(($) => $.twilio.calls.list({ limit: 20 }));
    const result = (await run(prog)) as any;
    expect(result.calls).toHaveLength(2);
    expect(result.calls[0].sid).toMatch(/^CA/);
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
        body: "Hello",
      });
      return $.twilio.messages((msg as any).sid).fetch();
    });
    const result = (await run(prog)) as any;
    // Fetch uses the fixture's fetch_message response regardless of SID
    expect(result.sid).toBeDefined();
    expect(result.status).toBe("delivered");
  });
});
