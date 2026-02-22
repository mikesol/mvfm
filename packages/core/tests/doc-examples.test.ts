/**
 * Doc-example smoke tests.
 *
 * Each test copies a doc example verbatim from packages/docs/src/examples/,
 * replacing `foldAST` with the public `fold` from api.ts.
 * Examples requiring external plugins (console_, fiber) are skipped.
 */
import { describe, expect, it } from "vitest";
import { defaults, error, fold, injectInput, mvfm, prelude, st } from "../src/index";

// ─── core examples ──────────────────────────────────────────────────

describe("core doc examples", () => {
  it("core/cond — conditional branching", async () => {
    const app = mvfm(prelude);
    const prog = app({ x: "number" }, ($: any) => {
      const total = $.add($.input.x, 1);
      const big = $.gt(total, 100);
      return $.cond(big)
        .t($.concat("big: ", $.show(total)))
        .f("small");
    });
    const result = await fold(defaults(app), injectInput(prog, { x: 250 }));
    expect(result).toBe("big: 251");
  });

  it("core/cond — else branch", async () => {
    const app = mvfm(prelude);
    const prog = app({ x: "number" }, ($: any) => {
      const total = $.add($.input.x, 1);
      const big = $.gt(total, 100);
      return $.cond(big)
        .t($.concat("big: ", $.show(total)))
        .f("small");
    });
    const result = await fold(defaults(app), injectInput(prog, { x: 5 }));
    expect(result).toBe("small");
  });

  it("core/literal — auto-lifted values", async () => {
    const app = mvfm(prelude);
    const prog = app({ x: "number" }, ($: any) => {
      return $.add($.input.x, 42);
    });
    const result = await fold(defaults(app), injectInput(prog, { x: 8 }));
    expect(result).toBe(50);
  });

  it("core/input — external input injection", async () => {
    const app = mvfm(prelude);
    const prog = app({ name: "string", age: "number" }, ($: any) => {
      const greeting = $.concat("Hi, ", $.input.name);
      const nextAge = $.add($.input.age, 1);
      return { greeting, nextAge };
    });
    const result = await fold(defaults(app), injectInput(prog, { name: "Alice", age: 30 }));
    expect(result).toEqual({ greeting: "Hi, Alice", nextAge: 31 });
  });

  it("core/record — object construction", async () => {
    const app = mvfm(prelude);
    const prog = app({ x: "number", label: "string" }, ($: any) => {
      const doubled = $.mul($.input.x, 2);
      return { value: doubled, tag: $.input.label };
    });
    const result = await fold(defaults(app), injectInput(prog, { x: 5, label: "result" }));
    expect(result).toEqual({ value: 10, tag: "result" });
  });

  it("core/tuple — array construction", async () => {
    const app = mvfm(prelude);
    const prog = app({ a: "number", b: "number" }, ($: any) => {
      const sum = $.add($.input.a, $.input.b);
      const diff = $.sub($.input.a, $.input.b);
      return [sum, diff];
    });
    const result = await fold(defaults(app), injectInput(prog, { a: 10, b: 3 }));
    expect(result).toEqual([13, 7]);
  });
});

// ─── num examples ───────────────────────────────────────────────────

describe("num doc examples", () => {
  it("num/add", async () => {
    const app = mvfm(prelude);
    const prog = app({ x: "number" }, ($: any) => $.add($.input.x, 10));
    expect(await fold(defaults(app), injectInput(prog, { x: 32 }))).toBe(42);
  });

  it("num/sub", async () => {
    const app = mvfm(prelude);
    const prog = app({ x: "number" }, ($: any) => $.sub($.input.x, 7));
    expect(await fold(defaults(app), injectInput(prog, { x: 50 }))).toBe(43);
  });

  it("num/mul", async () => {
    const app = mvfm(prelude);
    const prog = app({ x: "number" }, ($: any) => $.mul($.input.x, 3));
    expect(await fold(defaults(app), injectInput(prog, { x: 14 }))).toBe(42);
  });

  it("num/div", async () => {
    const app = mvfm(prelude);
    const prog = app({ x: "number" }, ($: any) => $.div($.input.x, 4));
    expect(await fold(defaults(app), injectInput(prog, { x: 100 }))).toBe(25);
  });

  it("num/mod", async () => {
    const app = mvfm(prelude);
    const prog = app({ x: "number" }, ($: any) => $.mod($.input.x, 3));
    expect(await fold(defaults(app), injectInput(prog, { x: 17 }))).toBe(2);
  });

  it("num/neg", async () => {
    const app = mvfm(prelude);
    const prog = app({ x: "number" }, ($: any) => $.neg($.input.x));
    expect(await fold(defaults(app), injectInput(prog, { x: 42 }))).toBe(-42);
  });

  it("num/show", async () => {
    const app = mvfm(prelude);
    const prog = app({ x: "number" }, ($: any) => {
      return $.concat("value is: ", $.show($.input.x));
    });
    expect(await fold(defaults(app), injectInput(prog, { x: 123 }))).toBe("value is: 123");
  });
});

// ─── str examples ───────────────────────────────────────────────────

describe("str doc examples", () => {
  it("str/concat", async () => {
    const app = mvfm(prelude);
    const prog = app({ first: "string", last: "string" }, ($: any) => {
      return $.concat($.input.first, " ", $.input.last);
    });
    expect(await fold(defaults(app), injectInput(prog, { first: "Jane", last: "Doe" }))).toBe(
      "Jane Doe",
    );
  });

  it("str/upper", async () => {
    const app = mvfm(prelude);
    const prog = app({ s: "string" }, ($: any) => $.upper($.input.s));
    expect(await fold(defaults(app), injectInput(prog, { s: "hello world" }))).toBe("HELLO WORLD");
  });

  it("str/len", async () => {
    const app = mvfm(prelude);
    const prog = app({ s: "string" }, ($: any) => $.len($.input.s));
    expect(await fold(defaults(app), injectInput(prog, { s: "hello" }))).toBe(5);
  });

  it("str/lower", async () => {
    const app = mvfm(prelude);
    const prog = app({ s: "string" }, ($: any) => $.lower($.input.s));
    expect(await fold(defaults(app), injectInput(prog, { s: "HELLO WORLD" }))).toBe("hello world");
  });

  it("str/trim", async () => {
    const app = mvfm(prelude);
    const prog = app({ s: "string" }, ($: any) => $.trim($.input.s));
    expect(await fold(defaults(app), injectInput(prog, { s: "  padded  " }))).toBe("padded");
  });
});

// ─── eq examples ────────────────────────────────────────────────────

describe("eq doc examples", () => {
  it("eq/eq — equal values", async () => {
    const app = mvfm(prelude);
    const prog = app({ x: "number", y: "number" }, ($: any) => {
      return $.eq($.input.x, $.input.y);
    });
    expect(await fold(defaults(app), injectInput(prog, { x: 10, y: 10 }))).toBe(true);
  });

  it("eq/neq — unequal values", async () => {
    const app = mvfm(prelude);
    const prog = app({ x: "number", y: "number" }, ($: any) => {
      return $.neq($.input.x, $.input.y);
    });
    expect(await fold(defaults(app), injectInput(prog, { x: 10, y: 20 }))).toBe(true);
  });
});

// ─── ord examples ───────────────────────────────────────────────────

describe("ord doc examples", () => {
  it("ord/gt", async () => {
    const app = mvfm(prelude);
    const prog = app({ x: "number", y: "number" }, ($: any) => {
      return $.gt($.input.x, $.input.y);
    });
    expect(await fold(defaults(app), injectInput(prog, { x: 10, y: 5 }))).toBe(true);
  });

  it("ord/lt", async () => {
    const app = mvfm(prelude);
    const prog = app({ x: "number", y: "number" }, ($: any) => {
      return $.lt($.input.x, $.input.y);
    });
    expect(await fold(defaults(app), injectInput(prog, { x: 3, y: 8 }))).toBe(true);
  });
});

// ─── st examples ────────────────────────────────────────────────────

describe("st doc examples", () => {
  it("st/let + get", async () => {
    const app = mvfm(prelude, st);
    const prog = app({ n: "number" }, ($: any) => {
      const counter = $.let($.input.n);
      return counter.get();
    });
    expect(await fold(defaults(app), injectInput(prog, { n: 10 }))).toBe(10);
  });

  it("st/set — overwrite then read", async () => {
    const app = mvfm(prelude, st);
    const prog = app({ x: "number" }, ($: any) => {
      const cell = $.let(0);
      cell.set($.mul($.input.x, 2));
      return cell.get();
    });
    expect(await fold(defaults(app), injectInput(prog, { x: 21 }))).toBe(42);
  });

  it("st/push — append to array", async () => {
    const app = mvfm(prelude, st);
    const prog = app({ x: "number" }, ($: any) => {
      const items = $.let([]);
      items.push($.input.x);
      items.push($.add($.input.x, 1));
      return items.get();
    });
    expect(await fold(defaults(app), injectInput(prog, { x: 5 }))).toEqual([5, 6]);
  });
});

// ─── error examples ─────────────────────────────────────────────────

describe("error doc examples", () => {
  it("error/try — recover from failure", async () => {
    const app = mvfm(prelude, error);
    const prog = app({ x: "number" }, ($: any) => {
      const risky = $.cond($.gt($.input.x, 10)).t($.input.x).f($.fail("too small"));
      return $.try(risky).catch((err: any) => $.concat("recovered: ", err));
    });
    const result = await fold(defaults(app), injectInput(prog, { x: 3 }));
    expect(result).toBe("recovered: too small");
  });

  it("error/fail — denied path", async () => {
    const app = mvfm(prelude, error);
    const prog = app({ age: "number" }, ($: any) => {
      const checked = $.cond($.gte($.input.age, 18))
        .t($.concat("welcome, age ", $.show($.input.age)))
        .f($.fail("must be 18+"));
      return $.try(checked).catch((err: any) => $.concat("denied: ", err));
    });
    const result = await fold(defaults(app), injectInput(prog, { age: 15 }));
    expect(result).toBe("denied: must be 18+");
  });
});
