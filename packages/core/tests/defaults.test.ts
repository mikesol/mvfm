import { describe, expect, it } from "vitest";
import type { Interpreter } from "../src/fold";
import { mvfm } from "../src/builder";
import { num } from "../src/plugins/num";
import { str } from "../src/plugins/str";

describe("PluginDefinition.defaultInterpreter", () => {
  it("structural discrimination works at type level", () => {
    type HasDefault<P> = P extends { defaultInterpreter: Record<string, any> }
      ? true
      : false;

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
    expect((app as any).plugins).toBeDefined();
    expect(Array.isArray((app as any).plugins)).toBe(true);
    expect((app as any).plugins.map((p: any) => p.name)).toEqual(["num", "str"]);
  });

  it("still works as a callable to define programs", () => {
    const app = mvfm(num, str);
    const prog = app(($) => $.sub(10, 3));
    expect(prog.ast).toBeDefined();
    expect(prog.hash).toBeDefined();
  });
});
