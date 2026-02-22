import { boolPluginU, createApp, defaults, fold, mvfmU, numPluginU, strPluginU } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { fetchInterpreter } from "../../src";
import { fetch as fetchPlugin } from "../../src/whatwg";
import { createFetchInterpreter, type FetchClient } from "../../src/whatwg/interpreter";

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

const plugin = fetchPlugin({ baseUrl: "https://api.test.com" });
const plugins = [numPluginU, strPluginU, boolPluginU, plugin] as const;
const $ = mvfmU(...plugins);
const app = createApp(...plugins);

async function run(expr: unknown) {
  const captured: Array<{ url: string; init?: RequestInit }> = [];
  const lastResponse = mockResponse({ message: "ok" }, 200, { "content-type": "application/json" });
  const mockClient: FetchClient = {
    async request(url, init) {
      captured.push({ url, init });
      return lastResponse;
    },
  };
  const nexpr = app(expr as ReturnType<typeof app> extends (e: infer E) => unknown ? E : never);
  const interp = defaults(plugins, {
    fetch: createFetchInterpreter(mockClient, { baseUrl: "https://api.test.com" }),
  });
  const result = await fold(nexpr, interp);
  return { captured, result };
}

// ============================================================
// fetch/request
// ============================================================

describe("fetch interpreter: request", () => {
  it("exports a default ready-to-use interpreter", () => {
    expect(typeof fetchInterpreter["fetch/request"]).toBe("function");
  });

  it("calls client.request with correct URL", async () => {
    const expr = $.fetch("https://api.example.com/data");
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].url).toBe("https://api.example.com/data");
  });

  it("calls client.request with method and headers", async () => {
    const expr = $.fetch("https://api.example.com/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"key":"value"}',
    });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].url).toBe("https://api.example.com/data");
    expect(captured[0].init).toEqual(
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"key":"value"}',
      }),
    );
  });

  it("prepends baseUrl to relative paths", async () => {
    const expr = $.fetch("/relative-path");
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].url).toBe("https://api.test.com/relative-path");
  });
});

// ============================================================
// fetch/json
// ============================================================

describe("fetch interpreter: json", () => {
  it("calls client.request then reads json from response", async () => {
    const resp = $.fetch("https://api.example.com/data");
    const expr = $.fetch.json(resp);
    const { captured, result } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(result).toEqual({ message: "ok" });
  });
});

// ============================================================
// fetch/text
// ============================================================

describe("fetch interpreter: text", () => {
  it("reads text from response", async () => {
    const resp = $.fetch("https://api.example.com/page");
    const expr = $.fetch.text(resp);
    const { result } = await run(expr);
    expect(typeof result).toBe("string");
  });
});

// ============================================================
// fetch/status
// ============================================================

describe("fetch interpreter: status", () => {
  it("reads status from response", async () => {
    const resp = $.fetch("https://api.example.com/data");
    const expr = $.fetch.status(resp);
    const { result } = await run(expr);
    expect(result).toBe(200);
  });
});

// ============================================================
// fetch/headers
// ============================================================

describe("fetch interpreter: headers", () => {
  it("reads headers from response", async () => {
    const resp = $.fetch("https://api.example.com/data");
    const expr = $.fetch.headers(resp);
    const { result } = await run(expr);
    expect((result as Record<string, string>)["content-type"]).toBe("application/json");
  });
});

// ============================================================
// Return value
// ============================================================

describe("fetch interpreter: return value", () => {
  it("returns the client response as the result", async () => {
    const expr = $.fetch("https://api.example.com/data");
    const { result } = await run(expr);
    expect(result).toBeDefined();
    expect((result as Response).status).toBe(200);
  });
});
