import { mvfm, num, str } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { cloudflareKv } from "../../src/4.20260213.0";

function strip(ast: unknown): unknown {
  return JSON.parse(
    JSON.stringify(ast, (k, v) => (k === "__id" || k === "config" ? undefined : v)),
  );
}

const app = mvfm(num, str, cloudflareKv({ namespaceId: "MY_KV" }));

// ============================================================
// get (text)
// ============================================================

describe("cloudflare-kv: get", () => {
  it("produces cloudflare-kv/get node with literal key", () => {
    const prog = app(($) => {
      return $.kv.get("my-key");
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("cloudflare-kv/get");
    expect(ast.result.key.kind).toBe("core/literal");
    expect(ast.result.key.value).toBe("my-key");
  });

  it("produces cloudflare-kv/get node with explicit 'text' type", () => {
    const prog = app(($) => {
      return $.kv.get("my-key", "text");
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("cloudflare-kv/get");
    expect(ast.result.key.kind).toBe("core/literal");
    expect(ast.result.key.value).toBe("my-key");
  });

  it("accepts Expr<string> key", () => {
    const prog = app(($) => {
      return $.kv.get($.input.cacheKey);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("cloudflare-kv/get");
    expect(ast.result.key.kind).toBe("core/prop_access");
  });
});

// ============================================================
// get (json)
// ============================================================

describe("cloudflare-kv: get with json type", () => {
  it("produces cloudflare-kv/get_json node with literal key", () => {
    const prog = app(($) => {
      return $.kv.get("config-key", "json");
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("cloudflare-kv/get_json");
    expect(ast.result.key.kind).toBe("core/literal");
    expect(ast.result.key.value).toBe("config-key");
  });

  it("accepts Expr<string> key with json type", () => {
    const prog = app(($) => {
      return $.kv.get($.input.configKey, "json");
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("cloudflare-kv/get_json");
    expect(ast.result.key.kind).toBe("core/prop_access");
  });
});

// ============================================================
// put
// ============================================================

describe("cloudflare-kv: put", () => {
  it("produces cloudflare-kv/put node with key and value", () => {
    const prog = app(($) => {
      return $.kv.put("my-key", "my-value");
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("cloudflare-kv/put");
    expect(ast.result.key.kind).toBe("core/literal");
    expect(ast.result.key.value).toBe("my-key");
    expect(ast.result.value.kind).toBe("core/literal");
    expect(ast.result.value.value).toBe("my-value");
    expect(ast.result.options).toBeNull();
  });

  it("accepts options with expirationTtl", () => {
    const prog = app(($) => {
      return $.kv.put("key", "val", { expirationTtl: 3600 });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("cloudflare-kv/put");
    expect(ast.result.options.kind).toBe("core/record");
    expect(ast.result.options.fields.expirationTtl.kind).toBe("core/literal");
    expect(ast.result.options.fields.expirationTtl.value).toBe(3600);
  });

  it("accepts Expr key and value", () => {
    const prog = app(($) => {
      return $.kv.put($.input.key, $.input.value);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.key.kind).toBe("core/prop_access");
    expect(ast.result.value.kind).toBe("core/prop_access");
  });
});

// ============================================================
// delete
// ============================================================

describe("cloudflare-kv: delete", () => {
  it("produces cloudflare-kv/delete node with literal key", () => {
    const prog = app(($) => {
      return $.kv.delete("old-key");
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("cloudflare-kv/delete");
    expect(ast.result.key.kind).toBe("core/literal");
    expect(ast.result.key.value).toBe("old-key");
  });

  it("accepts Expr<string> key", () => {
    const prog = app(($) => {
      return $.kv.delete($.input.keyToDelete);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("cloudflare-kv/delete");
    expect(ast.result.key.kind).toBe("core/prop_access");
  });
});

// ============================================================
// list
// ============================================================

describe("cloudflare-kv: list", () => {
  it("produces cloudflare-kv/list node with options", () => {
    const prog = app(($) => {
      return $.kv.list({ prefix: "user:", limit: 100 });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("cloudflare-kv/list");
    expect(ast.result.options.kind).toBe("core/record");
    expect(ast.result.options.fields.prefix.value).toBe("user:");
    expect(ast.result.options.fields.limit.value).toBe(100);
  });

  it("optional options are null when omitted", () => {
    const prog = app(($) => {
      return $.kv.list();
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("cloudflare-kv/list");
    expect(ast.result.options).toBeNull();
  });
});

// ============================================================
// cross-operation dependencies
// ============================================================

describe("cloudflare-kv: cross-operation dependencies", () => {
  it("can use result of get as input to put", () => {
    const prog = app(($) => {
      const cached = $.kv.get("source-key");
      const stored = $.kv.put("dest-key", cached);
      return $.begin(cached, stored);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("core/begin");
  });
});
