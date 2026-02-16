import { describe, expect, it } from "vitest";
import type { PluginDefinition } from "../src/core";
import { mvfm } from "../src/core";
import { num } from "../src/plugins/num";
import { semiring } from "../src/plugins/semiring";
import { str } from "../src/plugins/str";

describe("core: content hashing", () => {
  const app = mvfm(num, semiring);

  it("identical programs produce identical hashes", () => {
    const prog1 = app(($) => $.add($.input.x, 1));
    const prog2 = app(($) => $.add($.input.x, 1));
    expect(prog1.hash).toBe(prog2.hash);
  });

  it("different programs produce different hashes", () => {
    const prog1 = app(($) => $.add($.input.x, 1));
    const prog2 = app(($) => $.add($.input.x, 2));
    expect(prog1.hash).not.toBe(prog2.hash);
  });
});

describe("core: program metadata", () => {
  it("lists plugin names", () => {
    const app = mvfm(num, str, semiring);
    const prog = app(($) => $.add(1, 2));
    expect(prog.plugins).toEqual(["num", "str", "semiring"]);
  });

  it("works with no plugins", () => {
    const app = mvfm();
    const prog = app(($) => $.input.x);
    expect(prog.plugins).toEqual([]);
  });
});

describe("core: trait protocol", () => {
  it("plugins field on PluginContext exposes loaded plugins", () => {
    let capturedPlugins: any[] = [];
    const spy: PluginDefinition<{}> = {
      name: "spy",
      nodeKinds: [],
      build(ctx) {
        capturedPlugins = ctx.plugins;
        return {};
      },
    };
    const app = mvfm(num, semiring, spy);
    app(($) => $.add(1, 2));
    expect(capturedPlugins).toHaveLength(3);
    expect(capturedPlugins[0].name).toBe("num");
    expect(capturedPlugins[1].name).toBe("semiring");
    expect(capturedPlugins[2].name).toBe("spy");
  });

  it("inputSchema on PluginContext exposes runtime schema", () => {
    let capturedSchema: any;
    const spy: PluginDefinition<{}> = {
      name: "spy",
      nodeKinds: [],
      build(ctx) {
        capturedSchema = ctx.inputSchema;
        return {};
      },
    };
    const app = mvfm(num, semiring, spy);
    app({ x: "number" }, ($) => $.add($.input.x, 1));
    expect(capturedSchema).toEqual({ x: "number" });
  });

  it("traits field on PluginDefinition is accessible", () => {
    const p: PluginDefinition<{}> = {
      name: "test",
      nodeKinds: ["test/eq"],
      traits: { eq: { type: "number", nodeKinds: { eq: "test/eq" } } },
      build() {
        return {};
      },
    };
    expect(p.traits?.eq?.type).toBe("number");
    expect(p.traits?.eq?.nodeKinds.eq).toBe("test/eq");
  });
});
