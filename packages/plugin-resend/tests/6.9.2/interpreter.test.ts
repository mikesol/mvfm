import type { Program } from "@mvfm/core";
import { coreInterpreter, foldAST, injectInput, mvfm, num, str } from "@mvfm/core";
import { describe, expect, it, vi } from "vitest";
import { resendInterpreter } from "../../src";
import { resend } from "../../src/6.9.2";
import { createResendInterpreter, type ResendClient } from "../../src/6.9.2/interpreter";

const app = mvfm(num, str, resend({ apiKey: "re_test_123" }));

describe("resend interpreter: default export", () => {
  it("throws when RESEND_API_KEY is missing", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const prog = app(($) =>
      $.resend.emails.send({
        from: "a@b.com",
        to: "c@d.com",
        subject: "Hi",
        html: "<p>Hello</p>",
      }),
    );
    const combined = { ...resendInterpreter, ...coreInterpreter };
    await expect(foldAST(combined, prog.ast.result)).rejects.toThrow(/RESEND_API_KEY/);
    vi.unstubAllEnvs();
  });

  it("exports a default ready-to-use interpreter when RESEND_API_KEY is set", () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_default");
    expect(typeof resendInterpreter["resend/send_email"]).toBe("function");
    vi.unstubAllEnvs();
  });
});

async function run(prog: Program, input: Record<string, unknown> = {}) {
  const captured: Array<{ method: string; path: string; params?: unknown }> = [];
  const injected = injectInput(prog, input);
  const mockClient: ResendClient = {
    async request(method: string, path: string, params?: unknown) {
      captured.push({ method, path, params });
      return { id: "mock_id" };
    },
  };
  const combined = { ...createResendInterpreter(mockClient), ...coreInterpreter };
  const result = await foldAST(combined, injected);
  return { result, captured };
}

// ============================================================
// Emails
// ============================================================

describe("resend interpreter: send_email", () => {
  it("yields POST /emails with correct params", async () => {
    const prog = app(($) =>
      $.resend.emails.send({ from: "a@b.com", to: "c@d.com", subject: "Hi", html: "<p>Hello</p>" }),
    );
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/emails");
    expect(captured[0].params).toEqual({
      from: "a@b.com",
      to: "c@d.com",
      subject: "Hi",
      html: "<p>Hello</p>",
    });
  });
});

describe("resend interpreter: get_email", () => {
  it("yields GET /emails/{id}", async () => {
    const prog = app(($) => $.resend.emails.get("email_123"));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/emails/email_123");
    expect(captured[0].params).toBeUndefined();
  });
});

// ============================================================
// Batch
// ============================================================

describe("resend interpreter: send_batch", () => {
  it("yields POST /emails/batch with resolved array", async () => {
    const prog = app(($) =>
      $.resend.batch.send([
        { from: "a@b.com", to: "c@d.com", subject: "One", html: "<p>1</p>" },
        { from: "a@b.com", to: "e@f.com", subject: "Two", html: "<p>2</p>" },
      ]),
    );
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/emails/batch");
    expect(captured[0].params).toEqual([
      { from: "a@b.com", to: "c@d.com", subject: "One", html: "<p>1</p>" },
      { from: "a@b.com", to: "e@f.com", subject: "Two", html: "<p>2</p>" },
    ]);
  });
});

// ============================================================
// Contacts
// ============================================================

describe("resend interpreter: create_contact", () => {
  it("yields POST /contacts with correct params", async () => {
    const prog = app(($) =>
      $.resend.contacts.create({ email: "user@example.com", firstName: "Jane" }),
    );
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/contacts");
    expect(captured[0].params).toEqual({ email: "user@example.com", firstName: "Jane" });
  });
});

describe("resend interpreter: get_contact", () => {
  it("yields GET /contacts/{id}", async () => {
    const prog = app(($) => $.resend.contacts.get("contact_123"));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/contacts/contact_123");
    expect(captured[0].params).toBeUndefined();
  });
});

describe("resend interpreter: list_contacts", () => {
  it("yields GET /contacts with no params", async () => {
    const prog = app(($) => $.resend.contacts.list());
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/contacts");
    expect(captured[0].params).toBeUndefined();
  });
});

describe("resend interpreter: remove_contact", () => {
  it("yields DELETE /contacts/{id}", async () => {
    const prog = app(($) => $.resend.contacts.remove("contact_456"));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("DELETE");
    expect(captured[0].path).toBe("/contacts/contact_456");
    expect(captured[0].params).toBeUndefined();
  });
});

// ============================================================
// Input resolution
// ============================================================

describe("resend interpreter: input resolution", () => {
  it("resolves input params through recurse", async () => {
    const prog = app({ recipient: "string", subject: "string" }, ($) =>
      $.resend.emails.send({
        from: "noreply@example.com",
        to: $.input.recipient,
        subject: $.input.subject,
        html: "<p>Hi</p>",
      }),
    );
    const { captured } = await run(prog, { recipient: "user@test.com", subject: "Dynamic" });
    expect(captured).toHaveLength(1);
    expect(captured[0].params).toEqual({
      from: "noreply@example.com",
      to: "user@test.com",
      subject: "Dynamic",
      html: "<p>Hi</p>",
    });
  });

  it("resolves input id for get", async () => {
    const prog = app({ emailId: "string" }, ($) => $.resend.emails.get($.input.emailId));
    const { captured } = await run(prog, { emailId: "email_dynamic_789" });
    expect(captured).toHaveLength(1);
    expect(captured[0].path).toBe("/emails/email_dynamic_789");
  });
});

// ============================================================
// Mock return value
// ============================================================

describe("resend interpreter: return value", () => {
  it("returns the handler response as the result", async () => {
    const prog = app(($) => $.resend.emails.get("email_123"));
    const { result } = await run(prog);
    expect(result).toEqual({ id: "mock_id" });
  });
});
