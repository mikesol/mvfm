import { coreInterpreter, foldAST, mvfm, num, str } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { fetch } from "../../src/whatwg";
import { createFetchInterpreter, type FetchClient } from "../../src/whatwg/interpreter";

const app = mvfm(num, str, fetch({ baseUrl: "https://api.test.com" }));

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

// Mock Response class for testing
function mockResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  const h = new Headers(headers);
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: h,
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  } as unknown as Response;
}

async function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const captured: any[] = [];
  const ast = injectInput(prog.ast, input);
  const lastResponse = mockResponse({ message: "ok" }, 200, { "content-type": "application/json" });
  const mockClient: FetchClient = {
    async request(url, init) {
      captured.push({ url, init });
      return lastResponse;
    },
  };
  const combined = { ...createFetchInterpreter(mockClient), ...coreInterpreter };
  const result = await foldAST(combined, ast.result);
  return { result, captured };
}

// ============================================================
// fetch/request
// ============================================================

describe("fetch interpreter: request with literal URL", () => {
  it("calls client.request with correct URL", async () => {
    const prog = app(($) => $.fetch("https://api.example.com/data"));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].url).toBe("https://api.example.com/data");
    expect(captured[0].init).toEqual({});
  });
});

describe("fetch interpreter: request with init", () => {
  it("calls client.request with method and headers", async () => {
    const prog = app(($) =>
      $.fetch("https://api.example.com/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"key":"value"}',
      }),
    );
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].url).toBe("https://api.example.com/data");
    expect(captured[0].init).toEqual({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"key":"value"}',
    });
  });
});

describe("fetch interpreter: request without init", () => {
  it("calls client.request without init when omitted", async () => {
    const prog = app(($) => $.fetch("https://api.example.com/data"));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
  });
});

describe("fetch interpreter: request carries config (baseUrl)", () => {
  it("prepends baseUrl to relative paths", async () => {
    const prog = app(($) => $.fetch("/relative-path"));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].url).toBe("https://api.test.com/relative-path");
  });
});

// ============================================================
// fetch/json
// ============================================================

describe("fetch interpreter: json", () => {
  it("calls client.request then reads json from response", async () => {
    const prog = app(($) => {
      const resp = $.fetch("https://api.example.com/data");
      return $.fetch.json(resp);
    });
    const { captured, result } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(result).toEqual({ message: "ok" });
  });
});

// ============================================================
// fetch/text
// ============================================================

describe("fetch interpreter: text", () => {
  it("reads text from response", async () => {
    const prog = app(($) => {
      const resp = $.fetch("https://api.example.com/page");
      return $.fetch.text(resp);
    });
    const { result } = await run(prog);
    expect(typeof result).toBe("string");
  });
});

// ============================================================
// fetch/status
// ============================================================

describe("fetch interpreter: status", () => {
  it("reads status from response", async () => {
    const prog = app(($) => {
      const resp = $.fetch("https://api.example.com/data");
      return $.fetch.status(resp);
    });
    const { result } = await run(prog);
    expect(result).toBe(200);
  });
});

// ============================================================
// fetch/headers
// ============================================================

describe("fetch interpreter: headers", () => {
  it("reads headers from response", async () => {
    const prog = app(($) => {
      const resp = $.fetch("https://api.example.com/data");
      return $.fetch.headers(resp);
    });
    const { result } = await run(prog);
    expect((result as any)["content-type"]).toBe("application/json");
  });
});

// ============================================================
// Input resolution
// ============================================================

describe("fetch interpreter: input resolution", () => {
  it("resolves input URL through evaluation", async () => {
    const prog = app({ apiUrl: "string" }, ($) => $.fetch($.input.apiUrl));
    const { captured } = await run(prog, { apiUrl: "https://dynamic.example.com/api" });
    expect(captured).toHaveLength(1);
    expect(captured[0].url).toBe("https://dynamic.example.com/api");
  });

  it("resolves input init params through evaluation", async () => {
    const prog = app({ method: "string", body: "string" }, ($) =>
      $.fetch("https://api.example.com/data", {
        method: $.input.method,
        body: $.input.body,
      }),
    );
    const { captured } = await run(prog, { method: "PUT", body: "updated" });
    expect(captured).toHaveLength(1);
    expect(captured[0].init).toEqual({ method: "PUT", body: "updated" });
  });
});

// ============================================================
// Return value
// ============================================================

describe("fetch interpreter: return value", () => {
  it("returns the client response as the result", async () => {
    const prog = app(($) => $.fetch("https://api.example.com/data"));
    const { result } = await run(prog);
    expect(result).toBeDefined();
    expect((result as any).status).toBe(200);
  });
});
