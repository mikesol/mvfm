import { describe, expect, it } from "vitest";
import { mvfm } from "../../../src/core";
import { foldAST } from "../../../src/fold";
import { coreInterpreter } from "../../../src/interpreters/core";
import { boolean } from "../../../src/plugins/boolean";
import { booleanInterpreter } from "../../../src/plugins/boolean/interpreter";
import { eq } from "../../../src/plugins/eq";
import { eqInterpreter } from "../../../src/plugins/eq/interpreter";
import { num } from "../../../src/plugins/num";
import { numInterpreter } from "../../../src/plugins/num/interpreter";
import { str } from "../../../src/plugins/str";
import { strInterpreter } from "../../../src/plugins/str/interpreter";

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

const combined = {
  ...coreInterpreter,
  ...numInterpreter,
  ...strInterpreter,
  ...booleanInterpreter,
  ...eqInterpreter,
};

async function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const ast = injectInput(prog.ast, input);
  return await foldAST(combined, ast.result);
}

describe("eq interpretation: numbers", () => {
  const app = mvfm(num, eq);

  it("equal numbers -> true", async () => {
    const prog = app(($) => $.eq(42, 42));
    expect(await run(prog)).toBe(true);
  });

  it("unequal numbers -> false", async () => {
    const prog = app(($) => $.eq(42, 99));
    expect(await run(prog)).toBe(false);
  });

  it("with input", async () => {
    const prog = app({ x: "number", y: "number" }, ($) => $.eq($.input.x, $.input.y));
    expect(await run(prog, { x: 5, y: 5 })).toBe(true);
    expect(await run(prog, { x: 5, y: 6 })).toBe(false);
  });
});

describe("eq interpretation: strings", () => {
  const app = mvfm(str, eq);

  it("equal strings -> true", async () => {
    const prog = app(($) => $.eq("hello", "hello"));
    expect(await run(prog)).toBe(true);
  });

  it("unequal strings -> false", async () => {
    const prog = app(($) => $.eq("hello", "world"));
    expect(await run(prog)).toBe(false);
  });

  it("with input", async () => {
    const prog = app({ name: "string" }, ($) => $.eq($.input.name, "alice"));
    expect(await run(prog, { name: "alice" })).toBe(true);
    expect(await run(prog, { name: "bob" })).toBe(false);
  });
});

describe("eq interpretation: booleans", () => {
  const app = mvfm(boolean, eq);

  it("equal booleans -> true", async () => {
    const prog = app(($) => $.eq(true, true));
    expect(await run(prog)).toBe(true);
  });

  it("unequal booleans -> false", async () => {
    const prog = app(($) => $.eq(true, false));
    expect(await run(prog)).toBe(false);
  });
});

describe("eq + cond interpretation: end-to-end", () => {
  const app = mvfm(num, str, eq);

  it("cond(eq(input.x, 1)).t('one').f('other') with x=1", async () => {
    const prog = app({ x: "number" }, ($) => $.cond($.eq($.input.x, 1)).t("one").f("other"));
    expect(await run(prog, { x: 1 })).toBe("one");
    expect(await run(prog, { x: 2 })).toBe("other");
  });

  it("cond(eq(input.name, 'alice')).t('found').f('not found')", async () => {
    const prog = app({ name: "string" }, ($) =>
      $.cond($.eq($.input.name, "alice")).t("found").f("not found"),
    );
    expect(await run(prog, { name: "alice" })).toBe("found");
    expect(await run(prog, { name: "bob" })).toBe("not found");
  });
});

describe("eq interpretation: neq", () => {
  const app = mvfm(num, eq);

  it("neq(1, 2) returns true", async () => {
    const prog = app(($) => $.neq(1, 2));
    expect(await run(prog)).toBe(true);
  });

  it("neq(42, 42) returns false", async () => {
    const prog = app(($) => $.neq(42, 42));
    expect(await run(prog)).toBe(false);
  });
});
