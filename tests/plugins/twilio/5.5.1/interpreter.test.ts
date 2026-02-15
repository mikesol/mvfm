import { describe, expect, it } from "vitest";
import { foldAST, ilo } from "../../../../src/core";
import { coreInterpreter } from "../../../../src/interpreters/core";
import { num } from "../../../../src/plugins/num";
import { str } from "../../../../src/plugins/str";
import { twilio } from "../../../../src/plugins/twilio/5.5.1";
import { twilioInterpreter } from "../../../../src/plugins/twilio/5.5.1/interpreter";

const app = ilo(num, str, twilio({ accountSid: "AC_test_123", authToken: "auth_test_456" }));
const fragments = [twilioInterpreter, coreInterpreter];

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

async function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const captured: any[] = [];
  const ast = injectInput(prog.ast, input);
  const recurse = foldAST(fragments, {
    "twilio/api_call": async (effect) => {
      captured.push(effect);
      return { sid: "mock_sid", status: "mock" };
    },
  });
  const result = await recurse(ast.result);
  return { result, captured };
}

// ============================================================
// Messages
// ============================================================

describe("twilio interpreter: create_message", () => {
  it("yields POST to Messages.json with correct params", async () => {
    const prog = app(($) =>
      $.twilio.messages.create({ to: "+15551234567", from: "+15559876543", body: "Hello" }),
    );
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("twilio/api_call");
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
    const prog = app(($) => $.twilio.messages("SM800f449d").fetch());
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("twilio/api_call");
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/2010-04-01/Accounts/AC_test_123/Messages/SM800f449d.json");
    expect(captured[0].params).toBeUndefined();
  });
});

describe("twilio interpreter: list_messages", () => {
  it("yields GET to Messages.json with params", async () => {
    const prog = app(($) => $.twilio.messages.list({ limit: 10 }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("twilio/api_call");
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/2010-04-01/Accounts/AC_test_123/Messages.json");
    expect(captured[0].params).toEqual({ limit: 10 });
  });

  it("yields GET with undefined params when omitted", async () => {
    const prog = app(($) => $.twilio.messages.list());
    const { captured } = await run(prog);
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
    const prog = app(($) =>
      $.twilio.calls.create({
        to: "+15551234567",
        from: "+15559876543",
        url: "https://example.com/twiml",
      }),
    );
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("twilio/api_call");
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
    const prog = app(($) => $.twilio.calls("CA42ed11f9").fetch());
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("twilio/api_call");
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/2010-04-01/Accounts/AC_test_123/Calls/CA42ed11f9.json");
    expect(captured[0].params).toBeUndefined();
  });
});

describe("twilio interpreter: list_calls", () => {
  it("yields GET to Calls.json with params", async () => {
    const prog = app(($) => $.twilio.calls.list({ limit: 20 }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("twilio/api_call");
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/2010-04-01/Accounts/AC_test_123/Calls.json");
    expect(captured[0].params).toEqual({ limit: 20 });
  });

  it("yields GET with undefined params when omitted", async () => {
    const prog = app(($) => $.twilio.calls.list());
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/2010-04-01/Accounts/AC_test_123/Calls.json");
    expect(captured[0].params).toBeUndefined();
  });
});

// ============================================================
// Input resolution
// ============================================================

describe("twilio interpreter: input resolution", () => {
  it("resolves input params through recurse", async () => {
    const prog = app({ to: "string", body: "string" }, ($) =>
      $.twilio.messages.create({
        to: $.input.to,
        from: "+15559876543",
        body: $.input.body,
      }),
    );
    const { captured } = await run(prog, { to: "+15551111111", body: "Dynamic message" });
    expect(captured).toHaveLength(1);
    expect(captured[0].params).toEqual({
      to: "+15551111111",
      from: "+15559876543",
      body: "Dynamic message",
    });
  });

  it("resolves input sid for fetch", async () => {
    const prog = app({ msgSid: "string" }, ($) => $.twilio.messages($.input.msgSid).fetch());
    const { captured } = await run(prog, { msgSid: "SM_dynamic_789" });
    expect(captured).toHaveLength(1);
    expect(captured[0].path).toBe("/2010-04-01/Accounts/AC_test_123/Messages/SM_dynamic_789.json");
  });
});

// ============================================================
// Return value
// ============================================================

describe("twilio interpreter: return value", () => {
  it("returns the handler response as the result", async () => {
    const prog = app(($) => $.twilio.messages("SM_123").fetch());
    const { result } = await run(prog);
    expect(result).toEqual({ sid: "mock_sid", status: "mock" });
  });
});
