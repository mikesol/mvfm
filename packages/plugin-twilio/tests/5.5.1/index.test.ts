import { describe, expect, it } from "vitest";
import { twilio, twilioPlugin } from "../../src/5.5.1";

const plugin = twilio({ accountSid: "AC_test_123", authToken: "auth_test_456" });
const api = plugin.ctors.twilio;

// ============================================================
// CExpr construction tests — Messages
// ============================================================

describe("twilio: messages.create", () => {
  it("produces twilio/create_message CExpr", () => {
    const expr = api.messages.create({
      to: "+15551234567",
      from: "+15559876543",
      body: "Hello",
    });
    expect(expr.__kind).toBe("twilio/create_message");
    expect(expr.__args).toHaveLength(1);
    const paramsArg = expr.__args[0] as { __kind: string };
    expect(paramsArg.__kind).toBe("twilio/record");
  });
});

describe("twilio: messages(sid).fetch", () => {
  it("produces twilio/fetch_message CExpr with literal sid", () => {
    const expr = api.messages("SM800f449d0399ed014aae2bcc0cc2f2ec").fetch();
    expect(expr.__kind).toBe("twilio/fetch_message");
    expect(expr.__args).toHaveLength(1);
    expect(expr.__args[0]).toBe("SM800f449d0399ed014aae2bcc0cc2f2ec");
  });

  it("accepts CExpr sid (proxy chained value)", () => {
    const msg = api.messages("SM123").fetch();
    const expr = api.messages(msg.sid).fetch();
    expect(expr.__kind).toBe("twilio/fetch_message");
    expect(expr.__args).toHaveLength(1);
    const sidArg = expr.__args[0] as { __kind: string };
    expect(sidArg.__kind).toBe("core/access");
  });
});

describe("twilio: messages.list", () => {
  it("produces twilio/list_messages CExpr with params", () => {
    const expr = api.messages.list({ limit: 10 });
    expect(expr.__kind).toBe("twilio/list_messages");
    expect(expr.__args).toHaveLength(1);
    const paramsArg = expr.__args[0] as { __kind: string };
    expect(paramsArg.__kind).toBe("twilio/record");
  });

  it("produces CExpr with no args when omitted", () => {
    const expr = api.messages.list();
    expect(expr.__kind).toBe("twilio/list_messages");
    expect(expr.__args).toHaveLength(0);
  });
});

// ============================================================
// CExpr construction tests — Calls
// ============================================================

describe("twilio: calls.create", () => {
  it("produces twilio/create_call CExpr", () => {
    const expr = api.calls.create({
      to: "+15551234567",
      from: "+15559876543",
      url: "https://example.com/twiml",
    });
    expect(expr.__kind).toBe("twilio/create_call");
    expect(expr.__args).toHaveLength(1);
    const paramsArg = expr.__args[0] as { __kind: string };
    expect(paramsArg.__kind).toBe("twilio/record");
  });
});

describe("twilio: calls(sid).fetch", () => {
  it("produces twilio/fetch_call CExpr with literal sid", () => {
    const expr = api.calls("CA42ed11f93dc08b952027ffbc406d0868").fetch();
    expect(expr.__kind).toBe("twilio/fetch_call");
    expect(expr.__args).toHaveLength(1);
    expect(expr.__args[0]).toBe("CA42ed11f93dc08b952027ffbc406d0868");
  });
});

describe("twilio: calls.list", () => {
  it("produces twilio/list_calls CExpr with params", () => {
    const expr = api.calls.list({ limit: 20 });
    expect(expr.__kind).toBe("twilio/list_calls");
    expect(expr.__args).toHaveLength(1);
    const paramsArg = expr.__args[0] as { __kind: string };
    expect(paramsArg.__kind).toBe("twilio/record");
  });

  it("produces CExpr with no args when omitted", () => {
    const expr = api.calls.list();
    expect(expr.__kind).toBe("twilio/list_calls");
    expect(expr.__args).toHaveLength(0);
  });
});

// ============================================================
// Unified Plugin shape
// ============================================================

describe("twilio plugin: unified Plugin shape", () => {
  it("has correct name", () => {
    expect(plugin.name).toBe("twilio");
  });

  it("has 8 node kinds (6 core + record + array)", () => {
    expect(Object.keys(plugin.kinds)).toHaveLength(8);
  });

  it("nodeKinds are all namespaced", () => {
    for (const kind of Object.keys(plugin.kinds)) {
      expect(kind).toMatch(/^twilio\//);
    }
  });

  it("kinds map has entries for all node kinds", () => {
    for (const kind of Object.keys(plugin.kinds)) {
      expect(plugin.kinds[kind]).toBeDefined();
    }
  });

  it("has empty traits and lifts", () => {
    expect(plugin.traits).toEqual({});
    expect(plugin.lifts).toEqual({});
  });

  it("has a defaultInterpreter factory", () => {
    expect(typeof plugin.defaultInterpreter).toBe("function");
  });
});

// ============================================================
// Factory aliases
// ============================================================

describe("twilio plugin: factory aliases", () => {
  it("twilio and twilioPlugin are the same function", () => {
    expect(twilio).toBe(twilioPlugin);
  });
});
