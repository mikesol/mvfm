import http from "node:http";
import { coreInterpreter, mvfm, num, numInterpreter, str, strInterpreter } from "@mvfm/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resend as resendPlugin } from "../../src/6.9.2";
import { serverEvaluate } from "../../src/6.9.2/handler.server";
import type { ResendClient } from "../../src/6.9.2/interpreter";
import { createResendInterpreter } from "../../src/6.9.2/interpreter";

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

let server: http.Server;
let port: number;

const app = mvfm(num, str, resendPlugin({ apiKey: "re_test_fake" }));

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

async function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const ast = injectInput(prog.ast, input);
  const client = createMockClient();
  const baseInterpreter = {
    ...createResendInterpreter(client),
    ...coreInterpreter,
    ...numInterpreter,
    ...strInterpreter,
  };
  const evaluate = serverEvaluate(client, baseInterpreter);
  return await evaluate(ast.result);
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
            data: emails.map((_: unknown, i: number) => ({ id: `email_batch_${i}` })),
          }),
        );
      } else if (req.method === "POST" && req.url === "/contacts") {
        res.end(JSON.stringify({ id: "contact_mock_001", object: "contact" }));
      } else if (req.method === "GET" && req.url?.startsWith("/contacts/")) {
        const id = req.url.split("/contacts/")[1];
        res.end(JSON.stringify({ id, object: "contact", email: "user@example.com" }));
      } else if (req.method === "GET" && req.url === "/contacts") {
        res.end(
          JSON.stringify({
            object: "list",
            data: [{ id: "contact_1", email: "a@example.com" }],
          }),
        );
      } else if (req.method === "DELETE" && req.url?.startsWith("/contacts/")) {
        res.end(JSON.stringify({ object: "contact", id: "contact_mock_001", deleted: true }));
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
        from: "a@example.com",
        to: "b@example.com",
        subject: "Chain",
        html: "<p>Test</p>",
      });
      return $.resend.emails.get((sent as any).id);
    });
    const result = (await run(prog)) as any;
    expect(result.object).toBe("email");
  });
});
