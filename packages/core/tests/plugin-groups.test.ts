import { describe, expect, it } from "vitest";
import type { PluginDefinition } from "../src";
import { mvfm, num, semiring, str } from "../src";

function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

function labelPlugin(label: string): PluginDefinition<{ tag(): any }> {
  return {
    name: `tag-${label}`,
    nodeKinds: [`tag/${label}`],
    build(ctx) {
      return {
        tag: () => ctx.expr({ kind: `tag/${label}` }),
      };
    },
  };
}

describe("mvfm plugin-group resolution", () => {
  it("keeps flat plugin calls valid", () => {
    const app = mvfm(num, str, semiring);
    const prog = app(($) => $.add(1, 2));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("num/add");
  });

  it("supports user-defined grouped plugins", () => {
    const coreMath = [num, semiring] as const;
    const text = [str] as const;
    const app = mvfm(coreMath, text);

    const prog = app(($) => $.concat("a", "b"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("str/concat");
  });

  it("supports arbitrarily nested groups", () => {
    const nested = [[[num], [[str]]], semiring] as const;
    const app = mvfm(nested);

    const prog = app(($) => $.add(1, 2));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("num/add");
  });

  it("preserves left-to-right order after flattening", () => {
    const a = labelPlugin("a");
    const b = labelPlugin("b");
    const c = labelPlugin("c");
    const app = mvfm([a, [b], [[c]]]);

    const prog = app(($) => $.tag());
    const ast = strip(prog.ast) as any;
    // later plugin should override earlier ones during $ assembly
    expect(ast.result.kind).toBe("tag/c");
  });
});
