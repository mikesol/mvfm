import { describe, expect, it } from "vitest";
import { mvfm } from "../src/builder";
import { defaults } from "../src/defaults";
import { foldAST, type Interpreter } from "../src/fold";
import { boolean } from "../src/plugins/boolean";
import { eq } from "../src/plugins/eq";
import { error } from "../src/plugins/error";
import { fiber } from "../src/plugins/fiber";
import { num } from "../src/plugins/num";
import { ord } from "../src/plugins/ord";
import { str } from "../src/plugins/str";
import { prelude } from "../src/prelude";

describe("core plugins have defaultInterpreter", () => {
  it.each([
    ["num", num],
    ["str", str],
    ["boolean", boolean],
    ["eq", eq],
    ["ord", ord],
    ["error", error],
    ["fiber", fiber],
  ])("%s has defaultInterpreter", (_name, plugin) => {
    expect(plugin.defaultInterpreter).toBeDefined();
    expect(typeof plugin.defaultInterpreter).toBe("object");
  });
});

describe("PluginDefinition.defaultInterpreter", () => {
  it("structural discrimination works at type level", () => {
    type HasDefault<P> = P extends { defaultInterpreter: Record<string, any> } ? true : false;

    const withDefault = {
      name: "test" as const,
      nodeKinds: ["test/op"],
      build: () => ({}),
      defaultInterpreter: {} as Interpreter,
    };

    const withoutDefault = {
      name: "nodefault" as const,
      nodeKinds: ["nodefault/op"],
      build: () => ({}),
    };

    type T1 = HasDefault<typeof withDefault>;
    type T2 = HasDefault<typeof withoutDefault>;
    const _t1: T1 = true;
    const _t2: T2 = false;
    expect(_t1).toBe(true);
    expect(_t2).toBe(false);
  });
});

describe("mvfm() return value", () => {
  it("exposes .plugins array on the returned define function", () => {
    const app = mvfm(num, str);
    expect(app.plugins).toBeDefined();
    expect(Array.isArray(app.plugins)).toBe(true);
    expect(app.plugins.map((p: any) => p.name)).toEqual(["num", "str"]);
  });

  it("still works as a callable to define programs", () => {
    const app = mvfm(num, str);
    const prog = app(($) => $.sub(10, 3));
    expect(prog.ast).toBeDefined();
    expect(prog.hash).toBeDefined();
  });
});

describe("defaults()", () => {
  const fakeInterp: Interpreter = {
    // biome-ignore lint/correctness/useYield: stub
    "fake/op": async function* () {
      return 42;
    },
  };

  it("all plugins have defaults — overrides optional", () => {
    const pluginA = {
      name: "a" as const,
      nodeKinds: ["a/op"] as const,
      build: () => ({}),
      defaultInterpreter: {
        // biome-ignore lint/correctness/useYield: stub
        "a/op": async function* () {
          return 1;
        },
      },
    };
    const pluginB = {
      name: "b" as const,
      nodeKinds: ["b/op"] as const,
      build: () => ({}),
      defaultInterpreter: {
        // biome-ignore lint/correctness/useYield: stub
        "b/op": async function* () {
          return 2;
        },
      },
    };

    const app = mvfm(pluginA, pluginB);
    // No overrides needed — should compile and run
    const interp = defaults(app);
    expect(interp["a/op"]).toBeDefined();
    expect(interp["b/op"]).toBeDefined();
    // Core handlers present
    expect(interp["core/literal"]).toBeDefined();
    expect(interp["core/program"]).toBeDefined();
  });

  it("override replaces a plugin default", () => {
    const pluginA = {
      name: "a" as const,
      nodeKinds: ["a/op"] as const,
      build: () => ({}),
      defaultInterpreter: {
        // biome-ignore lint/correctness/useYield: stub
        "a/op": async function* () {
          return "default";
        },
      },
    };

    const customInterp: Interpreter = {
      // biome-ignore lint/correctness/useYield: stub
      "a/op": async function* () {
        return "custom";
      },
    };

    const app = mvfm(pluginA);
    const interp = defaults(app, { a: customInterp });
    // Should use override, not default
    expect(interp["a/op"]).toBe(customInterp["a/op"]);
  });

  it("plugin without default — override required (compile-time)", () => {
    const withDefault = {
      name: "hasdef" as const,
      nodeKinds: ["hasdef/op"] as const,
      build: () => ({}),
      defaultInterpreter: {
        // biome-ignore lint/correctness/useYield: stub
        "hasdef/op": async function* () {
          return 1;
        },
      },
    };
    const noDefault = {
      name: "nodef" as const,
      nodeKinds: ["nodef/op"] as const,
      build: () => ({}),
    };

    const app = mvfm(withDefault, noDefault);

    // @ts-expect-error — must provide override for "nodef"
    expect(() => defaults(app)).toThrow(/nodef/);

    // Providing the override compiles and works
    const interp = defaults(app, { nodef: fakeInterp });
    expect(interp["hasdef/op"]).toBeDefined();
    expect(interp["fake/op"]).toBeDefined();
  });

  it("runtime error when plugin lacks both default and override", () => {
    const noDefault = {
      name: "bare" as const,
      nodeKinds: ["bare/op"] as const,
      build: () => ({}),
    };

    const app = mvfm(noDefault);
    // Force past type system for runtime check
    expect(() => (defaults as any)(app)).toThrow('Plugin "bare" has no defaultInterpreter');
  });

  it("composed interpreter includes core handlers", () => {
    const pluginA = {
      name: "a" as const,
      nodeKinds: ["a/op"] as const,
      build: () => ({}),
      defaultInterpreter: {
        // biome-ignore lint/correctness/useYield: stub
        "a/op": async function* () {
          return 1;
        },
      },
    };

    const app = mvfm(pluginA);
    const interp = defaults(app);

    // All core interpreter keys present
    expect(interp["core/literal"]).toBeDefined();
    expect(interp["core/input"]).toBeDefined();
    expect(interp["core/cond"]).toBeDefined();
    expect(interp["core/begin"]).toBeDefined();
    expect(interp["core/program"]).toBeDefined();
    expect(interp["core/record"]).toBeDefined();
    expect(interp["core/prop_access"]).toBeDefined();
    expect(interp["core/tuple"]).toBeDefined();
    expect(interp["core/lambda_param"]).toBeDefined();
  });
});

// ---- helpers for integration tests ----

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

describe("defaults() end-to-end", () => {
  it("num arithmetic: sub(10, 3) = 7", async () => {
    const app = mvfm(num);
    const prog = app(($) => $.sub(10, 3));
    const interp = defaults(app);
    const result = await foldAST(interp, prog.ast);
    expect(result).toBe(7);
  });

  it("num arithmetic: nested sub(div(12, 4), 1) = 2", async () => {
    const app = mvfm(num);
    const prog = app(($) => $.sub($.div(12, 4), 1));
    const interp = defaults(app);
    const result = await foldAST(interp, prog.ast);
    expect(result).toBe(2);
  });

  it("with schema input: sub(input.n, 1)", async () => {
    const app = mvfm(num);
    const prog = app({ n: "number" }, ($) => $.sub($.input.n, 1));
    const interp = defaults(app);
    const ast = injectInput(prog.ast, { n: 10 });
    const result = await foldAST(interp, ast);
    expect(result).toBe(9);
  });

  it("conditional: cond(eq(1, 1)).t(42).f(0) = 42", async () => {
    const app = mvfm(num, boolean, eq);
    const prog = app(($) => $.cond($.eq(1, 1)).t(42).f(0));
    const interp = defaults(app);
    const result = await foldAST(interp, prog.ast);
    expect(result).toBe(42);
  });

  it("string operations: concat", async () => {
    const app = mvfm(str);
    const prog = app(($) => $.concat("hello", " ", "world"));
    const interp = defaults(app);
    const result = await foldAST(interp, prog.ast);
    expect(result).toBe("hello world");
  });

  it("string with input: upper(input.name)", async () => {
    const app = mvfm(str);
    const prog = app({ name: "string" }, ($) => $.upper($.input.name));
    const interp = defaults(app);
    const ast = injectInput(prog.ast, { name: "alice" });
    const result = await foldAST(interp, ast);
    expect(result).toBe("ALICE");
  });

  it("ord comparison: gt(5, 3) = true", async () => {
    const app = mvfm(num, ord);
    const prog = app(($) => $.gt(5, 3));
    const interp = defaults(app);
    const result = await foldAST(interp, prog.ast);
    expect(result).toBe(true);
  });

  it("eq + cond: dispatch on input", async () => {
    const app = mvfm(num, str, eq);
    const prog = app({ x: "number" }, ($) => $.cond($.eq($.input.x, 1)).t("one").f("other"));
    const interp = defaults(app);

    const ast1 = injectInput(prog.ast, { x: 1 });
    expect(await foldAST(interp, ast1)).toBe("one");

    const ast2 = injectInput(prog.ast, { x: 2 });
    expect(await foldAST(interp, ast2)).toBe("other");
  });

  it("works with prelude (typeclass plugins have empty defaultInterpreter)", async () => {
    const app = mvfm(...prelude);
    const interp = defaults(app);
    const prog = app(($) => $.add(1, 2));
    const result = await foldAST(interp, prog.ast);
    expect(result).toBe(3);
  });
});
