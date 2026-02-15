import { describe, expect, it } from "vitest";
import { mvfm } from "../../../../src/core";
import { fetch } from "../../../../src/plugins/fetch/whatwg";
import { num } from "../../../../src/plugins/num";
import { str } from "../../../../src/plugins/str";

function strip(ast: unknown): unknown {
  return JSON.parse(
    JSON.stringify(ast, (k, v) => (k === "__id" || k === "config" ? undefined : v)),
  );
}

const app = mvfm(num, str, fetch());

// ============================================================
// fetch/request — $.fetch(url, init?)
// ============================================================

describe("fetch: request with literal URL", () => {
  it("produces fetch/request node", () => {
    const prog = app(($) => {
      return $.fetch("https://api.example.com/data");
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("fetch/request");
    expect(ast.result.url.kind).toBe("core/literal");
    expect(ast.result.url.value).toBe("https://api.example.com/data");
    expect(ast.result.init).toBeNull();
  });
});

describe("fetch: request with Expr URL", () => {
  it("accepts Expr<string> url", () => {
    const prog = app(($) => {
      return $.fetch($.input.apiUrl);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("fetch/request");
    expect(ast.result.url.kind).toBe("core/prop_access");
  });
});

describe("fetch: request with init options", () => {
  it("produces fetch/request node with init", () => {
    const prog = app(($) => {
      return $.fetch("https://api.example.com/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"key":"value"}',
      });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("fetch/request");
    expect(ast.result.init.kind).toBe("core/record");
    expect(ast.result.init.fields.method.kind).toBe("core/literal");
    expect(ast.result.init.fields.method.value).toBe("POST");
    expect(ast.result.init.fields.body.kind).toBe("core/literal");
    expect(ast.result.init.fields.body.value).toBe('{"key":"value"}');
  });
});

describe("fetch: request with Expr init", () => {
  it("accepts Expr params in init", () => {
    const prog = app(($) => {
      return $.fetch($.input.url, {
        method: $.input.method,
        body: $.input.body,
      });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("fetch/request");
    expect(ast.result.url.kind).toBe("core/prop_access");
    expect(ast.result.init.fields.method.kind).toBe("core/prop_access");
    expect(ast.result.init.fields.body.kind).toBe("core/prop_access");
  });
});

// ============================================================
// fetch/json — $.fetch.json(response)
// ============================================================

describe("fetch: json", () => {
  it("produces fetch/json node wrapping a fetch/request", () => {
    const prog = app(($) => {
      const response = $.fetch("https://api.example.com/data");
      return $.fetch.json(response);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("fetch/json");
    expect(ast.result.response.kind).toBe("fetch/request");
  });
});

// ============================================================
// fetch/text — $.fetch.text(response)
// ============================================================

describe("fetch: text", () => {
  it("produces fetch/text node wrapping a fetch/request", () => {
    const prog = app(($) => {
      const response = $.fetch("https://api.example.com/page");
      return $.fetch.text(response);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("fetch/text");
    expect(ast.result.response.kind).toBe("fetch/request");
  });
});

// ============================================================
// fetch/status — $.fetch.status(response)
// ============================================================

describe("fetch: status", () => {
  it("produces fetch/status node wrapping a fetch/request", () => {
    const prog = app(($) => {
      const response = $.fetch("https://api.example.com/data");
      return $.fetch.status(response);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("fetch/status");
    expect(ast.result.response.kind).toBe("fetch/request");
  });
});

// ============================================================
// fetch/headers — $.fetch.headers(response)
// ============================================================

describe("fetch: headers", () => {
  it("produces fetch/headers node wrapping a fetch/request", () => {
    const prog = app(($) => {
      const response = $.fetch("https://api.example.com/data");
      return $.fetch.headers(response);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("fetch/headers");
    expect(ast.result.response.kind).toBe("fetch/request");
  });
});

// ============================================================
// Integration with $.do()
// ============================================================

describe("fetch: integration with $.do()", () => {
  it("chained operations wrapped in $.do() are reachable", () => {
    expect(() => {
      app(($) => {
        const resp1 = $.fetch("https://api.example.com/users");
        const data1 = $.fetch.json(resp1);
        const resp2 = $.fetch("https://api.example.com/posts");
        const data2 = $.fetch.json(resp2);
        return $.do(data1, data2);
      });
    }).not.toThrow();
  });
});

// ============================================================
// Cross-operation dependencies
// ============================================================

describe("fetch: cross-operation dependencies", () => {
  it("can use result of json parse as input to another request", () => {
    const prog = app(($) => {
      const resp = $.fetch("https://api.example.com/token");
      const data = $.fetch.json(resp);
      return $.fetch("https://api.example.com/protected", {
        headers: { Authorization: (data as any).token },
      });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("fetch/request");
    // The init headers should reference the json result via prop_access
    expect(ast.result.init.fields.headers.fields.Authorization.kind).toBe("core/prop_access");
  });
});

// ============================================================
// Config is baked into AST
// ============================================================

describe("fetch: config baked into AST", () => {
  it("stores config on fetch/request nodes", () => {
    const appWithConfig = mvfm(
      num,
      str,
      fetch({ baseUrl: "https://api.example.com", defaultHeaders: { "X-Api-Key": "test" } }),
    );
    const prog = appWithConfig(($) => {
      return $.fetch("/data");
    });
    // Don't strip config for this test
    const ast = JSON.parse(JSON.stringify(prog.ast, (k, v) => (k === "__id" ? undefined : v)));
    expect(ast.result.config.baseUrl).toBe("https://api.example.com");
    expect(ast.result.config.defaultHeaders["X-Api-Key"]).toBe("test");
  });
});
