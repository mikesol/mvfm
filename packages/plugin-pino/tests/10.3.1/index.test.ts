import { describe, expect, it } from "vitest";
import { pino, pinoPlugin } from "../../src/10.3.1";

const plugin = pino({ level: "info" });
const api = plugin.ctors.pino;

// ============================================================
// CExpr construction
// ============================================================

describe("pino: CExpr construction for log methods", () => {
  const levels = ["trace", "debug", "info", "warn", "error", "fatal"] as const;

  for (const level of levels) {
    it(`$.pino.${level}() emits CExpr with pino/${level}`, () => {
      const expr = (api as any)[level]("test message");
      expect(expr.__kind).toBe(`pino/${level}`);
      expect(Array.isArray(expr.__args)).toBe(true);
    });
  }
});

describe("pino: msg-only children layout", () => {
  it("msg-only: [1, 0, msg]", () => {
    const expr = api.info("user logged in");
    expect(expr.__kind).toBe("pino/info");
    expect(expr.__args[0]).toBe(1); // hasMsg
    expect(expr.__args[1]).toBe(0); // hasMergeObj
    expect(expr.__args[2]).toBe("user logged in"); // msg
    expect(expr.__args).toHaveLength(3);
  });
});

describe("pino: mergeObject + msg children layout", () => {
  it("two args: [1, 1, msg, mergeObj]", () => {
    const expr = api.info({ userId: 123 }, "user logged in");
    expect(expr.__kind).toBe("pino/info");
    expect(expr.__args[0]).toBe(1); // hasMsg
    expect(expr.__args[1]).toBe(1); // hasMergeObj
    // args[2] = msg (string)
    expect(expr.__args[2]).toBe("user logged in");
    // args[3] = mergeObj (pino/record CExpr)
    expect((expr.__args[3] as any).__kind).toBe("pino/record");
  });
});

describe("pino: object-only logging", () => {
  it("raw object single arg: [0, 1, mergeObj]", () => {
    const expr = api.info({ userId: 123 });
    expect(expr.__kind).toBe("pino/info");
    expect(expr.__args[0]).toBe(0); // hasMsg
    expect(expr.__args[1]).toBe(1); // hasMergeObj
    expect((expr.__args[2] as any).__kind).toBe("pino/record");
    expect(expr.__args).toHaveLength(3);
  });

  it("CExpr single arg is treated as msg", () => {
    // When a CExpr is passed as a single arg, it's treated as msg
    const msgExpr = api.info("dynamic");
    expect(msgExpr.__args[0]).toBe(1); // hasMsg
    expect(msgExpr.__args[1]).toBe(0); // hasMergeObj
  });
});

// ============================================================
// Child loggers
// ============================================================

describe("pino: child logger", () => {
  it("child bindings appear as extra children", () => {
    const expr = api.child({ requestId: "abc" }).info("handling request");
    expect(expr.__kind).toBe("pino/info");
    // [hasMsg=1, hasMergeObj=0, msg, binding0]
    expect(expr.__args[0]).toBe(1);
    expect(expr.__args[1]).toBe(0);
    expect(expr.__args[2]).toBe("handling request");
    expect((expr.__args[3] as any).__kind).toBe("pino/record");
    expect(expr.__args).toHaveLength(4);
  });

  it("nested child loggers accumulate bindings", () => {
    const expr = api.child({ requestId: "abc" }).child({ userId: 42 }).warn("slow query");
    expect(expr.__kind).toBe("pino/warn");
    // [hasMsg=1, hasMergeObj=0, msg, binding0, binding1]
    expect(expr.__args).toHaveLength(5);
    expect((expr.__args[3] as any).__kind).toBe("pino/record");
    expect((expr.__args[4] as any).__kind).toBe("pino/record");
  });
});

// ============================================================
// Unified Plugin shape
// ============================================================

describe("pino: unified Plugin shape", () => {
  it("has correct name", () => {
    expect(plugin.name).toBe("pino");
  });

  it("has 8 node kinds (6 levels + record + array)", () => {
    expect(plugin.nodeKinds).toHaveLength(8);
  });

  it("nodeKinds are all namespaced", () => {
    for (const kind of plugin.nodeKinds) {
      expect(kind).toMatch(/^pino\//);
    }
  });

  it("kinds map has entries for all node kinds", () => {
    for (const kind of plugin.nodeKinds) {
      expect(plugin.kinds[kind]).toBeDefined();
    }
  });

  it("has empty traits and lifts", () => {
    expect(plugin.traits).toEqual({});
    expect(plugin.lifts).toEqual({});
  });

  it("has a defaultInterpreter factory", () => {
    expect(typeof plugin.defaultInterpreter).toBe("function");
    const interp = plugin.defaultInterpreter();
    for (const kind of plugin.nodeKinds) {
      expect(typeof interp[kind]).toBe("function");
    }
  });

  it("pinoPlugin is an alias for pino", () => {
    expect(pinoPlugin).toBe(pino);
  });
});
