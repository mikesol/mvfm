import { describe, it, expect } from "vitest";
import { defaults } from "../../src/dag/index";
import type { PluginDef, Interpreter, Handler } from "../../src/dag/index";
import type { RuntimeEntry } from "../../src/dag/index";

// ─── Test helpers ───────────────────────────────────────────────────

function litHandler(): Handler {
  return async function* (entry: RuntimeEntry) {
    return entry.out;
  };
}

function addHandler(): Handler {
  return async function* (_entry: RuntimeEntry) {
    const left = yield 0;
    const right = yield 1;
    return (left as number) + (right as number);
  };
}

function customLitHandler(): Handler {
  return async function* (_entry: RuntimeEntry) {
    return 999; // always returns 999
  };
}

// ─── Tests ──────────────────────────────────────────────────────────

describe("defaults()", () => {
  it("merges interpreters from multiple plugins", () => {
    const numPlugin: PluginDef = {
      name: "num",
      nodeKinds: ["num/literal", "num/add"],
      defaultInterpreter: () => ({
        "num/literal": litHandler(),
        "num/add": addHandler(),
      }),
    };
    const strPlugin: PluginDef = {
      name: "str",
      nodeKinds: ["str/literal"],
      defaultInterpreter: () => ({
        "str/literal": litHandler(),
      }),
    };
    const interp = defaults([numPlugin, strPlugin]);
    expect(interp["num/literal"]).toBeDefined();
    expect(interp["num/add"]).toBeDefined();
    expect(interp["str/literal"]).toBeDefined();
  });

  it("throws for plugin without default and no override", () => {
    const plugin: PluginDef = {
      name: "broken",
      nodeKinds: ["broken/thing"],
    };
    expect(() => defaults([plugin])).toThrow(
      'Plugin "broken" has no defaultInterpreter and no override',
    );
  });

  it("accepts plugins with no nodeKinds (harmless)", () => {
    const emptyPlugin: PluginDef = {
      name: "empty",
      nodeKinds: [],
    };
    const interp = defaults([emptyPlugin]);
    expect(Object.keys(interp)).toHaveLength(0);
  });

  it("uses override instead of defaultInterpreter", () => {
    const plugin: PluginDef = {
      name: "num",
      nodeKinds: ["num/literal"],
      defaultInterpreter: () => ({
        "num/literal": litHandler(),
      }),
    };
    const customInterp: Interpreter = {
      "num/literal": customLitHandler(),
    };
    const interp = defaults([plugin], { num: customInterp });
    // The override handler should be used, not the default
    expect(interp["num/literal"]).toBe(customInterp["num/literal"]);
  });

  it("override satisfies plugin without defaultInterpreter", () => {
    const plugin: PluginDef = {
      name: "ext",
      nodeKinds: ["ext/foo"],
    };
    const override: Interpreter = {
      "ext/foo": litHandler(),
    };
    const interp = defaults([plugin], { ext: override });
    expect(interp["ext/foo"]).toBeDefined();
  });
});
