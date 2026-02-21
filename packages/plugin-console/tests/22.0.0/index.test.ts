import { describe, expect, it } from "vitest";
import { consolePlugin } from "../../src/22.0.0";

const plugin = consolePlugin();
const api = plugin.ctors.console;

const cases: ReadonlyArray<{ method: string; args: unknown[] }> = [
  { method: "assert", args: [true, "ok"] },
  { method: "clear", args: [] },
  { method: "count", args: ["my-counter"] },
  { method: "countReset", args: ["my-counter"] },
  { method: "debug", args: ["d1", 2] },
  { method: "dir", args: [{ a: 1 }, { depth: 1 }] },
  { method: "dirxml", args: ["<xml />"] },
  { method: "error", args: ["err", { e: 1 }] },
  { method: "group", args: ["g", 1] },
  { method: "groupCollapsed", args: ["gc"] },
  { method: "groupEnd", args: [] },
  { method: "info", args: ["i"] },
  { method: "log", args: ["l", 2, true] },
  { method: "table", args: [[{ a: 1 }]] },
  { method: "time", args: ["t"] },
  { method: "timeEnd", args: ["t"] },
  { method: "timeLog", args: ["t", "extra"] },
  { method: "trace", args: ["trace"] },
  { method: "warn", args: ["warn"] },
];

describe("console plugin: CExpr construction", () => {
  for (const c of cases) {
    it(`$.console.${c.method}() emits CExpr with console/${c.method}`, () => {
      const expr = (api as any)[c.method](...c.args);
      expect(expr.__kind).toBe(`console/${c.method}`);
      expect(Array.isArray(expr.__args)).toBe(true);
    });
  }
});

describe("console plugin: special argument behavior", () => {
  it("clear and groupEnd produce zero-arg CExprs", () => {
    expect(api.clear().__args).toHaveLength(0);
    expect(api.groupEnd().__args).toHaveLength(0);
  });

  it("dir captures optional second parameter", () => {
    const expr = api.dir("item", { depth: 2 });
    expect(expr.__kind).toBe("console/dir");
    expect(expr.__args).toHaveLength(2);
  });

  it("dir with no args produces zero-arg CExpr", () => {
    const expr = api.dir();
    expect(expr.__args).toHaveLength(0);
  });

  it("timeLog captures label plus extra args", () => {
    const expr = api.timeLog("timer", "extra1", "extra2");
    expect(expr.__kind).toBe("console/timeLog");
    expect(expr.__args).toHaveLength(3);
  });
});

describe("console plugin: unified Plugin shape", () => {
  it("has correct name", () => {
    expect(plugin.name).toBe("console");
  });

  it("has 19 node kinds", () => {
    expect(plugin.nodeKinds).toHaveLength(19);
  });

  it("nodeKinds are all namespaced", () => {
    for (const kind of plugin.nodeKinds) {
      expect(kind).toMatch(/^console\//);
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
});
