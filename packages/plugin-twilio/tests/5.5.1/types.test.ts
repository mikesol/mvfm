import type { Expr } from "@mvfm/core";
import { mvfm, num, str } from "@mvfm/core";
import { describe, expectTypeOf, it } from "vitest";
import { twilio } from "../../src/5.5.1";
import type { CallInstance, MessageInstance } from "../../src/5.5.1/types";

const app = mvfm(num, str, twilio({ accountSid: "AC_test", authToken: "tok" }));

describe("twilio type parity", () => {
  it("messages.create returns Expr<MessageInstance>", () => {
    app(($) => {
      const msg = $.twilio.messages.create({ to: "+1", from: "+1", body: "hi" });
      expectTypeOf(msg).toEqualTypeOf<Expr<MessageInstance>>();
      return msg;
    });
  });

  it("messages(sid).fetch returns Expr<MessageInstance>", () => {
    app(($) => {
      const msg = $.twilio.messages("SM123").fetch();
      expectTypeOf(msg).toEqualTypeOf<Expr<MessageInstance>>();
      return msg;
    });
  });

  it("messages.list returns Expr<MessageInstance[]>", () => {
    app(($) => {
      const msgs = $.twilio.messages.list({ pageSize: 10 });
      expectTypeOf(msgs).toEqualTypeOf<Expr<MessageInstance[]>>();
      return msgs;
    });
  });

  it("calls.create returns Expr<CallInstance>", () => {
    app(($) => {
      const call = $.twilio.calls.create({ to: "+1", from: "+1", url: "https://x.com/twiml" });
      expectTypeOf(call).toEqualTypeOf<Expr<CallInstance>>();
      return call;
    });
  });

  it("calls(sid).fetch returns Expr<CallInstance>", () => {
    app(($) => {
      const call = $.twilio.calls("CA123").fetch();
      expectTypeOf(call).toEqualTypeOf<Expr<CallInstance>>();
      return call;
    });
  });

  it("calls.list returns Expr<CallInstance[]>", () => {
    app(($) => {
      const calls = $.twilio.calls.list({ pageSize: 20 });
      expectTypeOf(calls).toEqualTypeOf<Expr<CallInstance[]>>();
      return calls;
    });
  });
});
