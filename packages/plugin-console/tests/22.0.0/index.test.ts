import { mvfm, num, str } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { consolePlugin } from "../../src/22.0.0";

function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

const app = mvfm(num, str, consolePlugin());

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

describe("console plugin: full method coverage emits namespaced node kinds", () => {
  for (const c of cases) {
    it(`$.console.${c.method}() emits console/${c.method}`, () => {
      const prog = app(($) => ($.console as any)[c.method](...c.args));
      const ast = strip(prog.ast) as any;
      expect(ast.result.kind).toBe(`console/${c.method}`);
      expect(ast.result.args).toBeDefined();
      expect(Array.isArray(ast.result.args)).toBe(true);
    });
  }
});

describe("console plugin: special argument behavior", () => {
  it("captures Expr values for assert data", () => {
    const prog = app(($) => $.console.assert($.input.ok, "message", $.input.detail));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("console/assert");
    expect(ast.result.args[0].kind).toBe("core/prop_access");
    expect(ast.result.args[2].kind).toBe("core/prop_access");
  });

  it("clear and groupEnd have zero args", () => {
    const clearProg = app(($) => $.console.clear());
    const clearAst = strip(clearProg.ast) as any;
    expect(clearAst.result.args).toHaveLength(0);

    const groupEndProg = app(($) => $.console.groupEnd());
    const groupEndAst = strip(groupEndProg.ast) as any;
    expect(groupEndAst.result.args).toHaveLength(0);
  });

  it("dir captures optional second parameter", () => {
    const prog = app(($) => $.console.dir($.input.obj, { depth: 2 }));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("console/dir");
    expect(ast.result.args).toHaveLength(2);
    expect(ast.result.args[0].kind).toBe("core/prop_access");
  });
});
