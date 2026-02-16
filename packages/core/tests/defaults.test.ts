import { describe, expect, it } from "vitest";
import { mvfm } from "../src/builder";
import { defaults } from "../src/defaults";
import type { Interpreter } from "../src/fold";
import { num } from "../src/plugins/num";
import { str } from "../src/plugins/str";

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
