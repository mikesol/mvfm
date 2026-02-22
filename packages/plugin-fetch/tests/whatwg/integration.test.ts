import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { createApp, defaults, fold, mvfmU, numPluginU, strPluginU } from "@mvfm/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fetch as fetchPlugin } from "../../src/whatwg";
import { wrapFetch } from "../../src/whatwg/client-fetch";
import { createFetchInterpreter } from "../../src/whatwg/interpreter";

let server: Server;
let baseUrl: string;

function handler(req: IncomingMessage, res: ServerResponse) {
  let body = "";
  req.on("data", (chunk: Buffer) => {
    body += chunk.toString();
  });
  req.on("end", () => {
    if (req.url === "/json" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "hello", count: 42 }));
      return;
    }
    if (req.url === "/text" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "text/plain", "X-Custom": "test-value" });
      res.end("Hello, world!");
      return;
    }
    if (req.url === "/echo" && req.method === "POST") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ echo: body, method: req.method }));
      return;
    }
    if (req.url === "/status-404") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
      return;
    }
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

// Helper: build plugins, $, app, and run for a given config
function setup(config?: { baseUrl?: string; defaultHeaders?: Record<string, string> }) {
  const plugin = fetchPlugin(config);
  const plugins = [numPluginU, strPluginU, plugin] as const;
  const $ = mvfmU(...plugins);
  const app = createApp(...plugins);
  const client = wrapFetch();

  async function run(expr: unknown) {
    const nexpr = app(expr as Parameters<typeof app>[0]);
    const interp = defaults(plugins, {
      fetch: createFetchInterpreter(client, config),
    });
    // Add core/access handler for property access chains
    interp["core/access"] = async function* (entry) {
      const parent = (yield 0) as Record<string, unknown>;
      return parent[entry.out as string];
    };
    return fold(nexpr, interp);
  }

  return { $, run };
}

// ============================================================
// Basic GET + json()
// ============================================================

describe("fetch integration: GET + json", () => {
  it("fetches JSON from server", async () => {
    const { $, run } = setup();
    const expr = $.fetch.json($.fetch(`${baseUrl}/json`));
    const result = (await run(expr)) as { message: string; count: number };
    expect(result.message).toBe("hello");
    expect(result.count).toBe(42);
  });
});

// ============================================================
// GET + text()
// ============================================================

describe("fetch integration: GET + text", () => {
  it("fetches text from server", async () => {
    const { $, run } = setup();
    const expr = $.fetch.text($.fetch(`${baseUrl}/text`));
    const result = await run(expr);
    expect(result).toBe("Hello, world!");
  });
});

// ============================================================
// GET + status()
// ============================================================

describe("fetch integration: GET + status", () => {
  it("returns 200 for successful request", async () => {
    const { $, run } = setup();
    const expr = $.fetch.status($.fetch(`${baseUrl}/json`));
    const result = await run(expr);
    expect(result).toBe(200);
  });

  it("returns 404 for not-found", async () => {
    const { $, run } = setup();
    const expr = $.fetch.status($.fetch(`${baseUrl}/status-404`));
    const result = await run(expr);
    expect(result).toBe(404);
  });
});

// ============================================================
// GET + headers()
// ============================================================

describe("fetch integration: GET + headers", () => {
  it("returns response headers", async () => {
    const { $, run } = setup();
    const expr = $.fetch.headers($.fetch(`${baseUrl}/text`));
    const result = (await run(expr)) as Record<string, string>;
    expect(result["content-type"]).toBe("text/plain");
    expect(result["x-custom"]).toBe("test-value");
  });
});

// ============================================================
// POST with body
// ============================================================

describe("fetch integration: POST + json", () => {
  it("sends POST with body and parses JSON response", async () => {
    const { $, run } = setup();
    const resp = $.fetch(`${baseUrl}/echo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"hello":"world"}',
    });
    const expr = $.fetch.json(resp);
    const result = (await run(expr)) as { echo: string; method: string };
    expect(result.echo).toBe('{"hello":"world"}');
    expect(result.method).toBe("POST");
  });
});

// ============================================================
// Config: baseUrl
// ============================================================

describe("fetch integration: baseUrl config", () => {
  it("prepends baseUrl to relative paths", async () => {
    // baseUrl is dynamic, so we build a fresh setup each time
    const { $, run } = setup({ baseUrl });
    const expr = $.fetch.json($.fetch("/json"));
    const result = (await run(expr)) as { message: string };
    expect(result.message).toBe("hello");
  });
});

// ============================================================
// Config: defaultHeaders
// ============================================================

describe("fetch integration: defaultHeaders config", () => {
  it("merges default headers into request", async () => {
    const { $, run } = setup({ defaultHeaders: { "X-Default": "from-config" } });
    const expr = $.fetch.json($.fetch(`${baseUrl}/headers-echo`));
    const result = (await run(expr)) as { receivedHeaders: Record<string, string> };
    expect(result.receivedHeaders["x-default"]).toBe("from-config");
  });
});

// ============================================================
// Chaining: fetch -> json -> use result in next fetch
// ============================================================

describe("fetch integration: chaining", () => {
  it("uses json result as input to another request", async () => {
    const { $, run } = setup();
    const resp1 = $.fetch(`${baseUrl}/json`);
    const data = $.fetch.json(resp1);
    const resp2 = $.fetch(`${baseUrl}/headers-echo`, {
      headers: { "X-Message": (data as unknown as { message: string }).message },
    });
    const expr = $.fetch.json(resp2);
    const result = (await run(expr)) as { receivedHeaders: Record<string, string> };
    expect(result.receivedHeaders["x-message"]).toBe("hello");
  });
});
