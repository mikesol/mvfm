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
import { resend as resendPlugin } from "../../src/6.9.2";
import { createResendInterpreter } from "../../src/6.9.2/interpreter";
import { createFixtureClient } from "./fixture-client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureClient = createFixtureClient(join(__dirname, "fixtures"));
const app = mvfm(num, str, resendPlugin({ apiKey: "re_test_fake" }));

async function run(prog: Program) {
  const injected = injectInput(prog, {});
  const combined = {
    ...createResendInterpreter(fixtureClient),
    ...coreInterpreter,
    ...numInterpreter,
    ...strInterpreter,
  };
  return await foldAST(combined, injected);
}

// ============================================================
// Emails
// ============================================================

describe("resend integration: emails", () => {
  it("send email", async () => {
    const prog = app(($) =>
      $.resend.emails.send({
        from: "sender@example.com",
        to: "recipient@example.com",
        subject: "Hello",
        html: "<p>World</p>",
      }),
    );
    const result = (await run(prog)) as any;
    expect(result.id).toBe("email_mock_001");
    expect(result.object).toBe("email");
  });

  it("get email", async () => {
    const prog = app(($) => $.resend.emails.get("email_abc"));
    const result = (await run(prog)) as any;
    expect(result.id).toBe("email_abc");
    expect(result.object).toBe("email");
  });
});

// ============================================================
// Batch
// ============================================================

describe("resend integration: batch", () => {
  it("send batch", async () => {
    const prog = app(($) =>
      $.resend.batch.send([
        { from: "a@example.com", to: "b@example.com", subject: "One", html: "<p>1</p>" },
        { from: "a@example.com", to: "c@example.com", subject: "Two", html: "<p>2</p>" },
      ]),
    );
    const result = (await run(prog)) as any;
    expect(result.data).toHaveLength(2);
  });
});

// ============================================================
// Contacts
// ============================================================

describe("resend integration: contacts", () => {
  it("create contact", async () => {
    const prog = app(($) => $.resend.contacts.create({ email: "user@example.com" }));
    const result = (await run(prog)) as any;
    expect(result.id).toBe("contact_mock_001");
  });

  it("get contact", async () => {
    const prog = app(($) => $.resend.contacts.get("contact_xyz"));
    const result = (await run(prog)) as any;
    expect(result.id).toBe("contact_xyz");
    expect(result.email).toBe("user@example.com");
  });

  it("list contacts", async () => {
    const prog = app(($) => $.resend.contacts.list());
    const result = (await run(prog)) as any;
    expect(result.object).toBe("list");
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("remove contact", async () => {
    const prog = app(($) => $.resend.contacts.remove("contact_del"));
    const result = (await run(prog)) as any;
    expect(result.deleted).toBe(true);
  });
});

// ============================================================
// Chaining
// ============================================================

describe("resend integration: chaining", () => {
  it("send email then get it by id", async () => {
    const prog = app(($) => {
      const sent = $.resend.emails.send({
        from: "sender@example.com",
        to: "recipient@example.com",
        subject: "Hello",
        html: "<p>World</p>",
      });
      return $.resend.emails.get((sent as any).id);
    });
    const result = (await run(prog)) as any;
    expect(result.object).toBe("email");
  });
});
