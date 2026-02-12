import { describe, expect, it } from "vitest";
import { ilo } from "../../../src/core";
import { str } from "../../../src/plugins/str";

function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

const app = ilo(str);

describe("str: tagged template", () => {
  it("produces str/template node", () => {
    const prog = app(($) => $.str`hello ${$.input.name}`);
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("str/template");
    expect(ast.result.strings).toEqual(["hello ", ""]);
    expect(ast.result.exprs).toHaveLength(1);
  });

  it("handles template with no interpolations", () => {
    const prog = app(($) => $.str`hello world`);
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("str/template");
    expect(ast.result.strings).toEqual(["hello world"]);
    expect(ast.result.exprs).toEqual([]);
  });
});

describe("str: concat", () => {
  it("produces str/concat with parts", () => {
    const prog = app(($) => $.concat($.input.first, " ", $.input.last));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("str/concat");
    expect(ast.result.parts).toHaveLength(3);
    expect(ast.result.parts[1].kind).toBe("core/literal");
    expect(ast.result.parts[1].value).toBe(" ");
  });
});

describe("str: unary string operations", () => {
  it.each([
    ["upper", "str/upper"],
    ["lower", "str/lower"],
    ["trim", "str/trim"],
  ] as const)("$.%s produces %s node", (method, kind) => {
    const prog = app(($) => ($[method] as any)($.input.s));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe(kind);
    expect(ast.result.operand.kind).toBe("core/prop_access");
  });
});

describe("str: slice", () => {
  it("produces str/slice with start", () => {
    const prog = app(($) => $.slice($.input.s, 0, 5));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("str/slice");
    expect(ast.result.start.value).toBe(0);
    expect(ast.result.end.value).toBe(5);
  });

  it("omits end when not provided", () => {
    const prog = app(($) => $.slice($.input.s, 3));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("str/slice");
    expect(ast.result.end).toBeUndefined();
  });
});

describe("str: boolean operations", () => {
  it.each([
    ["includes", "str/includes"],
    ["startsWith", "str/startsWith"],
    ["endsWith", "str/endsWith"],
  ] as const)("$.%s produces %s node", (method, kind) => {
    const prog = app(($) => ($[method] as any)($.input.s, "test"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe(kind);
  });
});

describe("str: split, join, replace, len", () => {
  it("$.split produces str/split", () => {
    const prog = app(($) => $.split($.input.s, ","));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("str/split");
  });

  it("$.join produces str/join", () => {
    const prog = app(($) => $.join($.input.arr, ", "));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("str/join");
  });

  it("$.replace produces str/replace", () => {
    const prog = app(($) => $.replace($.input.s, "old", "new"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("str/replace");
  });

  it("$.len produces str/len", () => {
    const prog = app(($) => $.len($.input.s));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("str/len");
  });
});

describe("str: trait declaration", () => {
  it("declares eq trait", () => {
    expect(str.traits?.eq).toEqual({ type: "string", nodeKinds: { eq: "str/eq" } });
    expect(str.nodeKinds).toContain("str/eq");
  });
});
