/**
 * Tests for str DAG plugin — interpreter and builder.
 */

import { describe, it, expect } from "vitest";
import { node, mvfm } from "../../src/dag/builder";
import { app } from "../../src/dag/03-normalize";
import { fold } from "../../src/dag/fold";
import { createCoreDagInterpreter } from "../../src/dag/core-interpreter";
import { createStrDagInterpreter } from "../../src/plugins/str/dag-interpreter";
import { strDagPlugin } from "../../src/plugins/str/dag-index";

const interp = {
  ...createCoreDagInterpreter(),
  ...createStrDagInterpreter(),
};

describe("str DAG interpreter", () => {
  it("str/upper converts to uppercase", async () => {
    const s = node<string>("core/literal", [], "hello");
    const upper = node<string>("str/upper", [s]);
    expect(await fold(app(upper), interp)).toBe("HELLO");
  });

  it("str/lower converts to lowercase", async () => {
    const s = node<string>("core/literal", [], "HELLO");
    const lower = node<string>("str/lower", [s]);
    expect(await fold(app(lower), interp)).toBe("hello");
  });

  it("str/trim removes whitespace", async () => {
    const s = node<string>("core/literal", [], "  hi  ");
    const trim = node<string>("str/trim", [s]);
    expect(await fold(app(trim), interp)).toBe("hi");
  });

  it("str/concat joins multiple strings", async () => {
    const a = node<string>("core/literal", [], "foo");
    const b = node<string>("core/literal", [], "bar");
    const c = node<string>("core/literal", [], "baz");
    const concat = node<string>("str/concat", [a, b, c]);
    expect(await fold(app(concat), interp)).toBe("foobarbaz");
  });

  it("str/template interpolates expressions", async () => {
    const name = node<string>("core/literal", [], "world");
    // out = ["Hello, ", "!"] — the string parts
    const tpl = node<string>("str/template", [name], ["Hello, ", "!"]);
    expect(await fold(app(tpl), interp)).toBe("Hello, world!");
  });

  it("str/len returns string length", async () => {
    const s = node<string>("core/literal", [], "hello");
    const len = node<number>("str/len", [s]);
    expect(await fold(app(len), interp)).toBe(5);
  });

  it("str/slice with start only", async () => {
    const s = node<string>("core/literal", [], "hello world");
    const start = node<number>("core/literal", [], 6);
    const slice = node<string>("str/slice", [s, start]);
    expect(await fold(app(slice), interp)).toBe("world");
  });

  it("str/slice with start and end", async () => {
    const s = node<string>("core/literal", [], "hello world");
    const start = node<number>("core/literal", [], 0);
    const end = node<number>("core/literal", [], 5);
    const slice = node<string>("str/slice", [s, start, end]);
    expect(await fold(app(slice), interp)).toBe("hello");
  });

  it("str/includes tests substring", async () => {
    const h = node<string>("core/literal", [], "hello world");
    const n = node<string>("core/literal", [], "world");
    const inc = node<boolean>("str/includes", [h, n]);
    expect(await fold(app(inc), interp)).toBe(true);
  });

  it("str/startsWith tests prefix", async () => {
    const s = node<string>("core/literal", [], "hello world");
    const p = node<string>("core/literal", [], "hello");
    const sw = node<boolean>("str/startsWith", [s, p]);
    expect(await fold(app(sw), interp)).toBe(true);
  });

  it("str/endsWith tests suffix", async () => {
    const s = node<string>("core/literal", [], "hello world");
    const suf = node<string>("core/literal", [], "world");
    const ew = node<boolean>("str/endsWith", [s, suf]);
    expect(await fold(app(ew), interp)).toBe(true);
  });

  it("str/split splits by delimiter", async () => {
    const s = node<string>("core/literal", [], "a,b,c");
    const d = node<string>("core/literal", [], ",");
    const split = node<string[]>("str/split", [s, d]);
    expect(await fold(app(split), interp)).toEqual(["a", "b", "c"]);
  });

  it("str/join joins with separator", async () => {
    const arr = node<string[]>("core/literal", [], ["a", "b", "c"]);
    const sep = node<string>("core/literal", [], "-");
    const join = node<string>("str/join", [arr, sep]);
    expect(await fold(app(join), interp)).toBe("a-b-c");
  });

  it("str/replace replaces first occurrence", async () => {
    const s = node<string>("core/literal", [], "foo bar foo");
    const search = node<string>("core/literal", [], "foo");
    const repl = node<string>("core/literal", [], "baz");
    const replace = node<string>("str/replace", [s, search, repl]);
    expect(await fold(app(replace), interp)).toBe("baz bar foo");
  });

  it("str/eq tests string equality", async () => {
    const a = node<string>("core/literal", [], "hello");
    const b = node<string>("core/literal", [], "hello");
    const eq = node<boolean>("str/eq", [a, b]);
    expect(await fold(app(eq), interp)).toBe(true);
  });

  it("str/append concatenates two strings", async () => {
    const a = node<string>("core/literal", [], "foo");
    const b = node<string>("core/literal", [], "bar");
    const append = node<string>("str/append", [a, b]);
    expect(await fold(app(append), interp)).toBe("foobar");
  });

  it("str/mempty returns empty string", async () => {
    const mempty = node<string>("str/mempty", []);
    expect(await fold(app(mempty), interp)).toBe("");
  });

  it("str/show returns string as-is", async () => {
    const s = node<string>("core/literal", [], "hello");
    const show = node<string>("str/show", [s]);
    expect(await fold(app(show), interp)).toBe("hello");
  });
});

describe("str DAG plugin via mvfm()", () => {
  it("upper via builder", async () => {
    const prog = mvfm(strDagPlugin, ($: any) => {
      return $.str.upper($.str.literal("hello"));
    });
    expect(await prog.eval()).toBe("HELLO");
  });

  it("concat via builder", async () => {
    const prog = mvfm(strDagPlugin, ($: any) => {
      return $.str.concat(
        $.str.literal("foo"),
        $.str.literal("bar"),
      );
    });
    expect(await prog.eval()).toBe("foobar");
  });

  it("template via builder", async () => {
    const prog = mvfm(strDagPlugin, ($: any) => {
      return $.str.template(
        ["Hello, ", "! You are ", "."],
        $.str.literal("world"),
        $.literal(42),
      );
    });
    expect(await prog.eval()).toBe("Hello, world! You are 42.");
  });
});
