import { describe, expect, it } from "vitest";
import { foldAST, mvfm } from "../../../../src/core";
import { coreInterpreter } from "../../../../src/interpreters/core";
import { fetch } from "../../../../src/plugins/fetch/whatwg";
import { fetchInterpreter } from "../../../../src/plugins/fetch/whatwg/interpreter";
import { num } from "../../../../src/plugins/num";
import { str } from "../../../../src/plugins/str";

const app = mvfm(num, str, fetch({ baseUrl: "https://api.test.com" }));
const fragments = [fetchInterpreter, coreInterpreter];

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
  return {
    status,
    headers: new Map(Object.entries(headers)),
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  };
}

async function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const httpCaptured: any[] = [];
  const bodyCaptured: any[] = [];
  const ast = injectInput(prog.ast, input);

  // Track mock responses so fetch/read_body can access them
  const lastResponse = mockResponse({ message: "ok" }, 200, { "content-type": "application/json" });

  const recurse = foldAST(fragments, {
    "fetch/http_request": async (effect) => {
      httpCaptured.push(effect);
      return lastResponse;
    },
    "fetch/read_body": async (effect) => {
      bodyCaptured.push(effect);
      const resp = effect.response as any;
      switch (effect.mode) {
        case "json":
          return resp.json ? await resp.json() : { message: "ok" };
        case "text":
          return resp.text ? await resp.text() : "ok";
        case "status":
          return resp.status ?? 200;
        case "headers": {
          const h: Record<string, string> = {};
          if (resp.headers?.forEach) {
            resp.headers.forEach((v: string, k: string) => {
              h[k] = v;
            });
          }
          return h;
        }
        default:
          throw new Error(`Unknown mode: ${effect.mode}`);
      }
    },
  });
  const result = await recurse(ast.result);
  return { result, httpCaptured, bodyCaptured };
}

// ============================================================
// fetch/request
// ============================================================

describe("fetch interpreter: request with literal URL", () => {
  it("yields fetch/http_request with correct URL", async () => {
    const prog = app(($) => $.fetch("https://api.example.com/data"));
    const { httpCaptured } = await run(prog);
    expect(httpCaptured).toHaveLength(1);
    expect(httpCaptured[0].type).toBe("fetch/http_request");
    expect(httpCaptured[0].url).toBe("https://api.example.com/data");
    expect(httpCaptured[0].init).toBeUndefined();
  });
});

describe("fetch interpreter: request with init", () => {
  it("yields fetch/http_request with method and headers", async () => {
    const prog = app(($) =>
      $.fetch("https://api.example.com/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"key":"value"}',
      }),
    );
    const { httpCaptured } = await run(prog);
    expect(httpCaptured).toHaveLength(1);
    expect(httpCaptured[0].type).toBe("fetch/http_request");
    expect(httpCaptured[0].url).toBe("https://api.example.com/data");
    expect(httpCaptured[0].init).toEqual({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"key":"value"}',
    });
  });
});

describe("fetch interpreter: request without init", () => {
  it("yields fetch/http_request without init when omitted", async () => {
    const prog = app(($) => $.fetch("https://api.example.com/data"));
    const { httpCaptured } = await run(prog);
    expect(httpCaptured).toHaveLength(1);
    expect(httpCaptured[0].init).toBeUndefined();
  });
});

describe("fetch interpreter: request carries config", () => {
  it("yields fetch/http_request with config from plugin", async () => {
    const prog = app(($) => $.fetch("/relative-path"));
    const { httpCaptured } = await run(prog);
    expect(httpCaptured).toHaveLength(1);
    expect(httpCaptured[0].config).toEqual({ baseUrl: "https://api.test.com" });
  });
});

// ============================================================
// fetch/json
// ============================================================

describe("fetch interpreter: json", () => {
  it("yields fetch/http_request then fetch/read_body with mode json", async () => {
    const prog = app(($) => {
      const resp = $.fetch("https://api.example.com/data");
      return $.fetch.json(resp);
    });
    const { httpCaptured, bodyCaptured, result } = await run(prog);
    expect(httpCaptured).toHaveLength(1);
    expect(bodyCaptured).toHaveLength(1);
    expect(bodyCaptured[0].type).toBe("fetch/read_body");
    expect(bodyCaptured[0].mode).toBe("json");
    expect(result).toEqual({ message: "ok" });
  });
});

// ============================================================
// fetch/text
// ============================================================

describe("fetch interpreter: text", () => {
  it("yields fetch/read_body with mode text", async () => {
    const prog = app(($) => {
      const resp = $.fetch("https://api.example.com/page");
      return $.fetch.text(resp);
    });
    const { bodyCaptured, result } = await run(prog);
    expect(bodyCaptured).toHaveLength(1);
    expect(bodyCaptured[0].mode).toBe("text");
    expect(typeof result).toBe("string");
  });
});

// ============================================================
// fetch/status
// ============================================================

describe("fetch interpreter: status", () => {
  it("yields fetch/read_body with mode status", async () => {
    const prog = app(($) => {
      const resp = $.fetch("https://api.example.com/data");
      return $.fetch.status(resp);
    });
    const { bodyCaptured, result } = await run(prog);
    expect(bodyCaptured).toHaveLength(1);
    expect(bodyCaptured[0].mode).toBe("status");
    expect(result).toBe(200);
  });
});

// ============================================================
// fetch/headers
// ============================================================

describe("fetch interpreter: headers", () => {
  it("yields fetch/read_body with mode headers", async () => {
    const prog = app(($) => {
      const resp = $.fetch("https://api.example.com/data");
      return $.fetch.headers(resp);
    });
    const { bodyCaptured, result } = await run(prog);
    expect(bodyCaptured).toHaveLength(1);
    expect(bodyCaptured[0].mode).toBe("headers");
    expect(result).toEqual({ "content-type": "application/json" });
  });
});

// ============================================================
// Input resolution
// ============================================================

describe("fetch interpreter: input resolution", () => {
  it("resolves input URL through recurse", async () => {
    const prog = app({ apiUrl: "string" }, ($) => $.fetch($.input.apiUrl));
    const { httpCaptured } = await run(prog, { apiUrl: "https://dynamic.example.com/api" });
    expect(httpCaptured).toHaveLength(1);
    expect(httpCaptured[0].url).toBe("https://dynamic.example.com/api");
  });

  it("resolves input init params through recurse", async () => {
    const prog = app({ method: "string", body: "string" }, ($) =>
      $.fetch("https://api.example.com/data", {
        method: $.input.method,
        body: $.input.body,
      }),
    );
    const { httpCaptured } = await run(prog, { method: "PUT", body: "updated" });
    expect(httpCaptured).toHaveLength(1);
    expect(httpCaptured[0].init).toEqual({ method: "PUT", body: "updated" });
  });
});

// ============================================================
// Return value
// ============================================================

describe("fetch interpreter: return value", () => {
  it("returns the handler response as the result", async () => {
    const prog = app(($) => $.fetch("https://api.example.com/data"));
    const { result } = await run(prog);
    // The mock handler returns a mock response object
    expect(result).toBeDefined();
    expect((result as any).status).toBe(200);
  });
});
