import { describe, expect, it } from "vitest";
import { mvfm } from "../../../../src/core";
import { num } from "../../../../src/plugins/num";
import { pino } from "../../../../src/plugins/pino/10.3.1";
import { str } from "../../../../src/plugins/str";

function strip(ast: unknown): unknown {
  return JSON.parse(
    JSON.stringify(ast, (k, v) => (k === "__id" || k === "config" ? undefined : v)),
  );
}

const app = mvfm(num, str, pino({ level: "info" }));

// ============================================================
// Level methods: info
// ============================================================

describe("pino: info with message only", () => {
  it("produces pino/info node with msg", () => {
    const prog = app(($) => $.pino.info("user logged in"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("pino/info");
    expect(ast.result.level).toBe("info");
    expect(ast.result.msg.kind).toBe("core/literal");
    expect(ast.result.msg.value).toBe("user logged in");
    expect(ast.result.mergeObject).toBeNull();
    expect(ast.result.bindings).toEqual([]);
  });
});

describe("pino: info with merge object and message", () => {
  it("produces pino/info node with mergeObject and msg", () => {
    const prog = app(($) => $.pino.info({ userId: 123 }, "user logged in"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("pino/info");
    expect(ast.result.mergeObject.kind).toBe("core/record");
    expect(ast.result.mergeObject.fields.userId.value).toBe(123);
    expect(ast.result.msg.value).toBe("user logged in");
  });
});

describe("pino: info with Expr params", () => {
  it("captures proxy dependencies in merge object", () => {
    const prog = app(($) => $.pino.info({ userId: $.input.id }, "user logged in"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("pino/info");
    expect(ast.result.mergeObject.fields.userId.kind).toBe("core/prop_access");
  });
});

// ============================================================
// All six levels
// ============================================================

describe("pino: all six log levels produce correct node kinds", () => {
  const levels = ["trace", "debug", "info", "warn", "error", "fatal"] as const;
  for (const level of levels) {
    it(`$.pino.${level}() produces pino/${level} node`, () => {
      const prog = app(($) => ($.pino as any)[level]("test message"));
      const ast = strip(prog.ast) as any;
      expect(ast.result.kind).toBe(`pino/${level}`);
      expect(ast.result.level).toBe(level);
    });
  }
});

// ============================================================
// Child loggers
// ============================================================

describe("pino: child logger", () => {
  it("child bindings are baked into the log node", () => {
    const prog = app(($) => $.pino.child({ requestId: "abc" }).info("handling request"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("pino/info");
    expect(ast.result.bindings).toHaveLength(1);
    expect(ast.result.bindings[0].kind).toBe("core/record");
    expect(ast.result.bindings[0].fields.requestId.value).toBe("abc");
  });

  it("nested child loggers accumulate bindings", () => {
    const prog = app(($) =>
      $.pino.child({ requestId: "abc" }).child({ userId: 42 }).warn("slow query"),
    );
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("pino/warn");
    expect(ast.result.bindings).toHaveLength(2);
    expect(ast.result.bindings[0].fields.requestId.value).toBe("abc");
    expect(ast.result.bindings[1].fields.userId.value).toBe(42);
  });

  it("child logger accepts Expr bindings", () => {
    const prog = app(($) => $.pino.child({ reqId: $.input.requestId }).info("test"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.bindings[0].fields.reqId.kind).toBe("core/prop_access");
  });
});

// ============================================================
// Object-only logging (no message)
// ============================================================

describe("pino: object-only logging (single raw object arg)", () => {
  it("raw object single arg becomes mergeObject, not msg", () => {
    const prog = app(($) => $.pino.info({ userId: 123 }));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("pino/info");
    expect(ast.result.mergeObject.kind).toBe("core/record");
    expect(ast.result.mergeObject.fields.userId.value).toBe(123);
    expect(ast.result.msg).toBeNull();
  });

  it("Expr single arg is treated as msg (use 2-arg form for Expr merge objects)", () => {
    const prog = app(($) => $.pino.info($.input.message));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("pino/info");
    expect(ast.result.msg.kind).toBe("core/prop_access");
    expect(ast.result.mergeObject).toBeNull();
  });
});

// ============================================================
// Integration with $.do()
// ============================================================

describe("pino: integration with $.do()", () => {
  it("log calls composed with $.do() are reachable", () => {
    expect(() => {
      app(($) => {
        const logLine = $.pino.info({ action: "login" }, "user logged in");
        return $.do(logLine, $.input.result);
      });
    }).not.toThrow();
  });

  it("orphaned log calls are rejected", () => {
    expect(() => {
      app(($) => {
        $.pino.info("this is orphaned");
        return $.input.result;
      });
    }).toThrow(/unreachable node/i);
  });
});
