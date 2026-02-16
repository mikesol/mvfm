import { mvfm, num, str } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { twilio } from "../../src/5.5.1";

function strip(ast: unknown): unknown {
  return JSON.parse(
    JSON.stringify(ast, (k, v) => (k === "__id" || k === "config" ? undefined : v)),
  );
}

const app = mvfm(num, str, twilio({ accountSid: "AC_test_123", authToken: "auth_test_456" }));

// ============================================================
// Messages
// ============================================================

describe("twilio: messages.create", () => {
  it("produces twilio/create_message node", () => {
    const prog = app(($) => {
      return $.twilio.messages.create({ to: "+15551234567", from: "+15559876543", body: "Hello" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("twilio/create_message");
    expect(ast.result.params.kind).toBe("core/record");
    expect(ast.result.params.fields.to.kind).toBe("core/literal");
    expect(ast.result.params.fields.to.value).toBe("+15551234567");
    expect(ast.result.params.fields.body.value).toBe("Hello");
  });

  it("accepts Expr params", () => {
    const prog = app(($) => {
      return $.twilio.messages.create({
        to: $.input.to,
        from: $.input.from,
        body: $.input.body,
      });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("twilio/create_message");
    expect(ast.result.params.fields.to.kind).toBe("core/prop_access");
    expect(ast.result.params.fields.body.kind).toBe("core/prop_access");
  });
});

describe("twilio: messages(sid).fetch", () => {
  it("produces twilio/fetch_message node with literal sid", () => {
    const prog = app(($) => {
      return $.twilio.messages("SM800f449d0399ed014aae2bcc0cc2f2ec").fetch();
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("twilio/fetch_message");
    expect(ast.result.sid.kind).toBe("core/literal");
    expect(ast.result.sid.value).toBe("SM800f449d0399ed014aae2bcc0cc2f2ec");
  });

  it("accepts Expr<string> sid", () => {
    const prog = app(($) => {
      return $.twilio.messages($.input.messageSid).fetch();
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("twilio/fetch_message");
    expect(ast.result.sid.kind).toBe("core/prop_access");
  });
});

describe("twilio: messages.list", () => {
  it("produces twilio/list_messages node with params", () => {
    const prog = app(($) => {
      return $.twilio.messages.list({ limit: 10 });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("twilio/list_messages");
    expect(ast.result.params.kind).toBe("core/record");
    expect(ast.result.params.fields.limit.value).toBe(10);
  });

  it("optional params are null when omitted", () => {
    const prog = app(($) => {
      return $.twilio.messages.list();
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("twilio/list_messages");
    expect(ast.result.params).toBeNull();
  });
});

// ============================================================
// Calls
// ============================================================

describe("twilio: calls.create", () => {
  it("produces twilio/create_call node", () => {
    const prog = app(($) => {
      return $.twilio.calls.create({
        to: "+15551234567",
        from: "+15559876543",
        url: "https://example.com/twiml",
      });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("twilio/create_call");
    expect(ast.result.params.kind).toBe("core/record");
    expect(ast.result.params.fields.to.value).toBe("+15551234567");
    expect(ast.result.params.fields.url.value).toBe("https://example.com/twiml");
  });
});

describe("twilio: calls(sid).fetch", () => {
  it("produces twilio/fetch_call node with literal sid", () => {
    const prog = app(($) => {
      return $.twilio.calls("CA42ed11f93dc08b952027ffbc406d0868").fetch();
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("twilio/fetch_call");
    expect(ast.result.sid.kind).toBe("core/literal");
    expect(ast.result.sid.value).toBe("CA42ed11f93dc08b952027ffbc406d0868");
  });
});

describe("twilio: calls.list", () => {
  it("produces twilio/list_calls node with params", () => {
    const prog = app(($) => {
      return $.twilio.calls.list({ limit: 20 });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("twilio/list_calls");
    expect(ast.result.params.kind).toBe("core/record");
    expect(ast.result.params.fields.limit.value).toBe(20);
  });

  it("optional params are null when omitted", () => {
    const prog = app(($) => {
      return $.twilio.calls.list();
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("twilio/list_calls");
    expect(ast.result.params).toBeNull();
  });
});

// ============================================================
// Integration: $.begin() and cross-operation dependencies
// ============================================================

describe("twilio: integration with $.begin()", () => {
  it("side-effecting operations wrapped in $.begin() are reachable", () => {
    expect(() => {
      app(($) => {
        const msg = $.twilio.messages.create({
          to: "+15551234567",
          from: "+15559876543",
          body: "Hello",
        });
        const call = $.twilio.calls.create({
          to: "+15551234567",
          from: "+15559876543",
          url: "https://example.com/twiml",
        });
        return $.begin(msg, call);
      });
    }).not.toThrow();
  });

  it("orphaned operations are rejected", () => {
    expect(() => {
      app(($) => {
        const msg = $.twilio.messages("SM_123").fetch();
        $.twilio.messages.create({ to: "+1", from: "+2", body: "orphan" }); // orphan!
        return msg;
      });
    }).toThrow(/unreachable node/i);
  });
});

describe("twilio: cross-operation dependencies", () => {
  it("can use result of one operation as input to another", () => {
    const prog = app(($) => {
      const msg = $.twilio.messages.create({
        to: "+15551234567",
        from: "+15559876543",
        body: "Hello",
      });
      const fetched = $.twilio.messages((msg as any).sid).fetch();
      return $.begin(msg, fetched);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("core/begin");
  });
});
