import http from "node:http";
import { boolPluginU, createApp, defaults, fold, mvfmU, numPluginU, strPluginU } from "@mvfm/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resend as resendPlugin } from "../../src/6.9.2";
import type { ResendClient } from "../../src/6.9.2/interpreter";
import { createResendInterpreter } from "../../src/6.9.2/interpreter";

let server: http.Server;
let port: number;

const plugin = resendPlugin({ apiKey: "re_test_fake" });
const plugins = [numPluginU, strPluginU, boolPluginU, plugin] as const;
const $ = mvfmU(...plugins);
const app = createApp(...plugins);

function createMockClient(): ResendClient {
  return {
    async request(method: string, path: string, params?: unknown): Promise<unknown> {
      const response = await fetch(`http://127.0.0.1:${port}${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        ...(params !== undefined ? { body: JSON.stringify(params) } : {}),
      });
      return response.json();
    },
  };
}

async function run(expr: unknown) {
  const nexpr = app(expr as Parameters<typeof app>[0]);
  const client = createMockClient();
  const interp = defaults(plugins, {
    resend: createResendInterpreter(client),
  });
  // Add core/access handler for property access chains (e.g. sent.id)
  interp["core/access"] = async function* (entry) {
    const parent = (yield 0) as Record<string, unknown>;
    return parent[entry.out as string];
  };
  return await fold(nexpr, interp);
}

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      res.setHeader("Content-Type", "application/json");

      if (req.method === "POST" && req.url === "/emails") {
        res.end(JSON.stringify({ id: "email_mock_001", object: "email" }));
      } else if (req.method === "GET" && req.url?.startsWith("/emails/")) {
        const id = req.url.split("/emails/")[1];
        res.end(
          JSON.stringify({
            id,
            object: "email",
            from: "sender@example.com",
            to: ["recipient@example.com"],
            subject: "Test",
            created_at: "2026-01-01T00:00:00Z",
          }),
        );
      } else if (req.method === "POST" && req.url === "/emails/batch") {
        const emails = JSON.parse(body || "[]");
        res.end(
          JSON.stringify({
            data: emails.map((_: unknown, i: number) => ({
              id: `email_batch_${i}`,
            })),
          }),
        );
      } else if (req.method === "POST" && req.url === "/contacts") {
        res.end(
          JSON.stringify({
            id: "contact_mock_001",
            object: "contact",
          }),
        );
      } else if (req.method === "GET" && req.url?.startsWith("/contacts/")) {
        const id = req.url.split("/contacts/")[1];
        res.end(
          JSON.stringify({
            id,
            object: "contact",
            email: "user@example.com",
          }),
        );
      } else if (req.method === "GET" && req.url === "/contacts") {
        res.end(
          JSON.stringify({
            object: "list",
            data: [{ id: "contact_1", email: "a@example.com" }],
          }),
        );
      } else if (req.method === "DELETE" && req.url?.startsWith("/contacts/")) {
        res.end(
          JSON.stringify({
            object: "contact",
            id: "contact_mock_001",
            deleted: true,
          }),
        );
      } else {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "not found" }));
      }
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      port = typeof addr === "object" && addr ? addr.port : 0;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

// ============================================================
// Emails
// ============================================================

describe("resend integration: emails", () => {
  it("send email", async () => {
    const expr = $.resend.emails.send({
      from: "sender@example.com",
      to: "recipient@example.com",
      subject: "Hello",
      html: "<p>World</p>",
    });
    const result = (await run(expr)) as Record<string, unknown>;
    expect(result.id).toBe("email_mock_001");
    expect(result.object).toBe("email");
  });

  it("get email", async () => {
    const expr = $.resend.emails.get("email_abc");
    const result = (await run(expr)) as Record<string, unknown>;
    expect(result.id).toBe("email_abc");
    expect(result.object).toBe("email");
  });
});

// ============================================================
// Batch
// ============================================================

describe("resend integration: batch", () => {
  it("send batch", async () => {
    const expr = $.resend.batch.send([
      {
        from: "a@example.com",
        to: "b@example.com",
        subject: "One",
        html: "<p>1</p>",
      },
      {
        from: "a@example.com",
        to: "c@example.com",
        subject: "Two",
        html: "<p>2</p>",
      },
    ]);
    const result = (await run(expr)) as Record<string, unknown>;
    expect(result.data).toHaveLength(2);
  });
});

// ============================================================
// Contacts
// ============================================================

describe("resend integration: contacts", () => {
  it("create contact", async () => {
    const expr = $.resend.contacts.create({
      email: "user@example.com",
    });
    const result = (await run(expr)) as Record<string, unknown>;
    expect(result.id).toBe("contact_mock_001");
  });

  it("get contact", async () => {
    const expr = $.resend.contacts.get("contact_xyz");
    const result = (await run(expr)) as Record<string, unknown>;
    expect(result.id).toBe("contact_xyz");
    expect(result.email).toBe("user@example.com");
  });

  it("list contacts", async () => {
    const expr = $.resend.contacts.list();
    const result = (await run(expr)) as Record<string, unknown>;
    expect(result.object).toBe("list");
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("remove contact", async () => {
    const expr = $.resend.contacts.remove("contact_del");
    const result = (await run(expr)) as Record<string, unknown>;
    expect(result.deleted).toBe(true);
  });
});

// ============================================================
// Chaining
// ============================================================

describe("resend integration: chaining", () => {
  it("send email then get it by id", async () => {
    const sent = $.resend.emails.send({
      from: "a@example.com",
      to: "b@example.com",
      subject: "Chain",
      html: "<p>Test</p>",
    });
    const expr = $.resend.emails.get(sent.id);
    const result = (await run(expr)) as Record<string, unknown>;
    expect(result.object).toBe("email");
  });
});
