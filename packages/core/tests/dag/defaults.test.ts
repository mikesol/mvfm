/**
 * Tests for interpreter composition via defaults().
 */

import { describe, it, expect } from "vitest";
import { defaults } from "../../src/dag/fold";
import type { PluginDef, Interpreter } from "../../src/dag/fold";
import { createCoreDagInterpreter } from "../../src/dag/core-interpreter";
import { createNumDagInterpreter } from "../../src/plugins/num/interpreter";
import { createStrDagInterpreter } from "../../src/plugins/str/interpreter";
import { numDagPlugin } from "../../src/plugins/num/index";
import { strDagPlugin } from "../../src/plugins/str/index";

const corePlugin: PluginDef = {
  name: "core",
  nodeKinds: ["core/literal", "core/cond", "core/discard"],
  defaultInterpreter: createCoreDagInterpreter,
};

describe("defaults()", () => {
  it("composes core + num interpreters", () => {
    const interp = defaults([corePlugin, numDagPlugin]);
    expect(interp["core/literal"]).toBeDefined();
    expect(interp["num/add"]).toBeDefined();
    expect(interp["num/sub"]).toBeDefined();
  });

  it("composes core + num + str interpreters", () => {
    const interp = defaults([corePlugin, numDagPlugin, strDagPlugin]);
    expect(interp["core/literal"]).toBeDefined();
    expect(interp["num/add"]).toBeDefined();
    expect(interp["str/upper"]).toBeDefined();
  });

  it("override replaces default interpreter", () => {
    const customNum: Interpreter = {
      "num/add": async function* () {
        return 999; // always returns 999
      },
    };
    const interp = defaults([corePlugin, numDagPlugin], {
      num: customNum,
    });
    expect(interp["num/add"]).toBe(customNum["num/add"]);
    // Core should still use default
    expect(interp["core/literal"]).toBeDefined();
  });

  it("throws for plugin with nodeKinds but no interpreter", () => {
    const badPlugin: PluginDef = {
      name: "bad",
      nodeKinds: ["bad/thing"],
    };
    expect(() => defaults([badPlugin])).toThrow(
      'Plugin "bad" has no defaultInterpreter and no override',
    );
  });

  it("accepts plugin with no nodeKinds and no interpreter", () => {
    const emptyPlugin: PluginDef = {
      name: "empty",
      nodeKinds: [],
    };
    expect(() => defaults([emptyPlugin])).not.toThrow();
  });

  it("override resolves missing defaultInterpreter", () => {
    const pluginNoDefault: PluginDef = {
      name: "custom",
      nodeKinds: ["custom/thing"],
    };
    const customInterp: Interpreter = {
      "custom/thing": async function* () {
        return "custom";
      },
    };
    const interp = defaults([pluginNoDefault], {
      custom: customInterp,
    });
    expect(interp["custom/thing"]).toBe(customInterp["custom/thing"]);
  });

  it("later plugins override earlier plugins with same kinds", () => {
    const plugin1: PluginDef = {
      name: "p1",
      nodeKinds: ["shared/kind"],
      defaultInterpreter: () => ({
        "shared/kind": async function* () {
          return "from-p1";
        },
      }),
    };
    const plugin2: PluginDef = {
      name: "p2",
      nodeKinds: ["shared/kind"],
      defaultInterpreter: () => ({
        "shared/kind": async function* () {
          return "from-p2";
        },
      }),
    };
    const interp = defaults([plugin1, plugin2]);
    // p2 comes last, so it should win
    expect(interp["shared/kind"]).toBeDefined();
  });
});
