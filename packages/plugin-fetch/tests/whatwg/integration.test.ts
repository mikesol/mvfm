import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { coreInterpreter, mvfm, num, numInterpreter, str, strInterpreter } from "@mvfm/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fetch as fetchPlugin } from "../../src/whatwg";
import { wrapFetch } from "../../src/whatwg/client-fetch";
import { serverEvaluate } from "../../src/whatwg/handler.server";

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

let server: Server;
let baseUrl: string;

const baseInterpreter = { ...coreInterpreter, ...numInterpreter, ...strInterpreter };

function handler(req: IncomingMessage, res: ServerResponse) {
  let body = "";
  req.on("data", (chunk: Buffer) => {
    body += chunk.toString();
  });
  req.on("end", () => {
    // Route: GET /json — returns JSON
    if (req.url === "/json" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "hello", count: 42 }));
      return;
    }

    // Route: GET /text — returns plain text
    if (req.url === "/text" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "text/plain", "X-Custom": "test-value" });
      res.end("Hello, world!");
      return;
    }

    // Route: POST /echo — echoes the request body as JSON
    if (req.url === "/echo" && req.method === "POST") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ echo: body, method: req.method }));
      return;
    }

    // Route: GET /status-404 — returns 404
    if (req.url === "/status-404") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
      return;
    }

    // Route: GET /headers-echo — echoes request headers
    if (req.url === "/headers-echo" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ receivedHeaders: req.headers }));
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });
}

beforeAll(async () => {
  server = createServer(handler);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const addr = server.address() as { port: number };
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

// ============================================================
// Basic GET + json()
// ============================================================

describe("fetch integration: GET + json", () => {
  it("fetches JSON from server", async () => {
    const app = mvfm(num, str, fetchPlugin());
    const prog = app(($) => {
      const resp = $.fetch(`${baseUrl}/json`);
      return $.fetch.json(resp);
    });
    const ast = injectInput(prog.ast, {});
    const client = wrapFetch();
    const evaluate = serverEvaluate(client, baseInterpreter);
    const result = (await evaluate(ast.result)) as any;
    expect(result.message).toBe("hello");
    expect(result.count).toBe(42);
  });
});

// ============================================================
// GET + text()
// ============================================================

describe("fetch integration: GET + text", () => {
  it("fetches text from server", async () => {
    const app = mvfm(num, str, fetchPlugin());
    const prog = app(($) => {
      const resp = $.fetch(`${baseUrl}/text`);
      return $.fetch.text(resp);
    });
    const ast = injectInput(prog.ast, {});
    const client = wrapFetch();
    const evaluate = serverEvaluate(client, baseInterpreter);
    const result = await evaluate(ast.result);
    expect(result).toBe("Hello, world!");
  });
});

// ============================================================
// GET + status()
// ============================================================

describe("fetch integration: GET + status", () => {
  it("returns 200 for successful request", async () => {
    const app = mvfm(num, str, fetchPlugin());
    const prog = app(($) => {
      const resp = $.fetch(`${baseUrl}/json`);
      return $.fetch.status(resp);
    });
    const ast = injectInput(prog.ast, {});
    const client = wrapFetch();
    const evaluate = serverEvaluate(client, baseInterpreter);
    const result = await evaluate(ast.result);
    expect(result).toBe(200);
  });

  it("returns 404 for not-found", async () => {
    const app = mvfm(num, str, fetchPlugin());
    const prog = app(($) => {
      const resp = $.fetch(`${baseUrl}/status-404`);
      return $.fetch.status(resp);
    });
    const ast = injectInput(prog.ast, {});
    const client = wrapFetch();
    const evaluate = serverEvaluate(client, baseInterpreter);
    const result = await evaluate(ast.result);
    expect(result).toBe(404);
  });
});

// ============================================================
// GET + headers()
// ============================================================

describe("fetch integration: GET + headers", () => {
  it("returns response headers", async () => {
    const app = mvfm(num, str, fetchPlugin());
    const prog = app(($) => {
      const resp = $.fetch(`${baseUrl}/text`);
      return $.fetch.headers(resp);
    });
    const ast = injectInput(prog.ast, {});
    const client = wrapFetch();
    const evaluate = serverEvaluate(client, baseInterpreter);
    const result = (await evaluate(ast.result)) as Record<string, string>;
    expect(result["content-type"]).toBe("text/plain");
    expect(result["x-custom"]).toBe("test-value");
  });
});

// ============================================================
// POST with body
// ============================================================

describe("fetch integration: POST + json", () => {
  it("sends POST with body and parses JSON response", async () => {
    const app = mvfm(num, str, fetchPlugin());
    const prog = app(($) => {
      const resp = $.fetch(`${baseUrl}/echo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"hello":"world"}',
      });
      return $.fetch.json(resp);
    });
    const ast = injectInput(prog.ast, {});
    const client = wrapFetch();
    const evaluate = serverEvaluate(client, baseInterpreter);
    const result = (await evaluate(ast.result)) as any;
    expect(result.echo).toBe('{"hello":"world"}');
    expect(result.method).toBe("POST");
  });
});

// ============================================================
// Config: baseUrl
// ============================================================

describe("fetch integration: baseUrl config", () => {
  it("prepends baseUrl to relative paths", async () => {
    const app = mvfm(num, str, fetchPlugin({ baseUrl }));
    const prog = app(($) => {
      const resp = $.fetch("/json");
      return $.fetch.json(resp);
    });
    const ast = injectInput(prog.ast, {});
    const client = wrapFetch();
    const evaluate = serverEvaluate(client, baseInterpreter);
    const result = (await evaluate(ast.result)) as any;
    expect(result.message).toBe("hello");
  });
});

// ============================================================
// Config: defaultHeaders
// ============================================================

describe("fetch integration: defaultHeaders config", () => {
  it("merges default headers into request", async () => {
    const app = mvfm(num, str, fetchPlugin({ defaultHeaders: { "X-Default": "from-config" } }));
    const prog = app(($) => {
      const resp = $.fetch(`${baseUrl}/headers-echo`);
      return $.fetch.json(resp);
    });
    const ast = injectInput(prog.ast, {});
    const client = wrapFetch();
    const evaluate = serverEvaluate(client, baseInterpreter);
    const result = (await evaluate(ast.result)) as any;
    expect(result.receivedHeaders["x-default"]).toBe("from-config");
  });
});

// ============================================================
// Chaining: fetch → json → use result in next fetch
// ============================================================

describe("fetch integration: chaining", () => {
  it("uses json result as input to another request", async () => {
    const app = mvfm(num, str, fetchPlugin());
    // Fetch JSON, then use a field from it as a header in a second request
    const prog = app(($) => {
      const resp1 = $.fetch(`${baseUrl}/json`);
      const data = $.fetch.json(resp1);
      const resp2 = $.fetch(`${baseUrl}/headers-echo`, {
        headers: { "X-Message": (data as any).message },
      });
      return $.fetch.json(resp2);
    });
    const ast = injectInput(prog.ast, {});
    const client = wrapFetch();
    const evaluate = serverEvaluate(client, baseInterpreter);
    const result = (await evaluate(ast.result)) as any;
    expect(result.receivedHeaders["x-message"]).toBe("hello");
  });
});

// ============================================================
// Input resolution
// ============================================================

describe("fetch integration: input resolution", () => {
  it("resolves URL from input", async () => {
    const app = mvfm(num, str, fetchPlugin());
    const prog = app({ url: "string" }, ($) => {
      const resp = $.fetch($.input.url);
      return $.fetch.json(resp);
    });
    const ast = injectInput(prog.ast, { url: `${baseUrl}/json` });
    const client = wrapFetch();
    const evaluate = serverEvaluate(client, baseInterpreter);
    const result = (await evaluate(ast.result)) as any;
    expect(result.message).toBe("hello");
  });
});
