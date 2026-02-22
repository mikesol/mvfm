import { boolPluginU, createApp, defaults, fold, mvfmU, numPluginU, strPluginU } from "@mvfm/core";
import { describe, expect, it, vi } from "vitest";
import { resendInterpreter } from "../../src";
import { resend } from "../../src/6.9.2";
import { createResendInterpreter, type ResendClient } from "../../src/6.9.2/interpreter";

const plugin = resend({ apiKey: "re_test_123" });
const plugins = [numPluginU, strPluginU, boolPluginU, plugin] as const;
const $ = mvfmU(...plugins);
const app = createApp(...plugins);

async function run(expr: unknown) {
  const captured: Array<{
    method: string;
    path: string;
    params?: unknown;
  }> = [];
  const mockClient: ResendClient = {
    async request(method: string, path: string, params?: unknown) {
      captured.push({ method, path, params });
      return { id: "mock_id" };
    },
  };
  const nexpr = app(expr as Parameters<typeof app>[0]);
  const interp = defaults(plugins, {
    resend: createResendInterpreter(mockClient),
  });
  const result = await fold(nexpr, interp);
  return { result, captured };
}

// ============================================================
// Default interpreter
// ============================================================

describe("resend interpreter: default export", () => {
  it("exports a default ready-to-use interpreter with RESEND_API_KEY", () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_default");
    expect(typeof resendInterpreter["resend/send_email"]).toBe("function");
    vi.unstubAllEnvs();
  });
});

// ============================================================
// Emails
// ============================================================

describe("resend interpreter: send_email", () => {
  it("yields POST /emails with correct params", async () => {
    const expr = $.resend.emails.send({
      from: "a@b.com",
      to: "c@d.com",
      subject: "Hi",
      html: "<p>Hello</p>",
    });
    const { captured } = await run(expr);
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
    const expr = $.resend.emails.get("email_123");
    const { captured } = await run(expr);
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
    const expr = $.resend.batch.send([
      {
        from: "a@b.com",
        to: "c@d.com",
        subject: "One",
        html: "<p>1</p>",
      },
      {
        from: "a@b.com",
        to: "e@f.com",
        subject: "Two",
        html: "<p>2</p>",
      },
    ]);
    const { captured } = await run(expr);
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
    const expr = $.resend.contacts.create({
      email: "user@example.com",
      firstName: "Jane",
    });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/contacts");
    expect(captured[0].params).toEqual({
      email: "user@example.com",
      firstName: "Jane",
    });
  });
});

describe("resend interpreter: get_contact", () => {
  it("yields GET /contacts/{id}", async () => {
    const expr = $.resend.contacts.get("contact_123");
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/contacts/contact_123");
    expect(captured[0].params).toBeUndefined();
  });
});

describe("resend interpreter: list_contacts", () => {
  it("yields GET /contacts with no params", async () => {
    const expr = $.resend.contacts.list();
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/contacts");
    expect(captured[0].params).toBeUndefined();
  });
});

describe("resend interpreter: remove_contact", () => {
  it("yields DELETE /contacts/{id}", async () => {
    const expr = $.resend.contacts.remove("contact_456");
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("DELETE");
    expect(captured[0].path).toBe("/contacts/contact_456");
    expect(captured[0].params).toBeUndefined();
  });
});

// ============================================================
// Return value
// ============================================================

describe("resend interpreter: return value", () => {
  it("returns the handler response as the result", async () => {
    const expr = $.resend.emails.get("email_123");
    const { result } = await run(expr);
    expect(result).toEqual({ id: "mock_id" });
  });
});
