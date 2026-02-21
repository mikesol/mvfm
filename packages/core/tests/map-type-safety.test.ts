import { describe, expect, it } from "vitest";
import type { CExpr, DirtyExpr, Handler, KindSpec, NExpr, Plugin } from "../src/koan";
import { koan } from "../src/koan";
import { createTestInterp } from "./kitchen-sink-helpers";

const itePlugin = {
  name: "ite",
  ctors: {
    ite: <C, T, E>(cond: C, then_: T, else_: E): CExpr<number, "ctrl/ite", [C, T, E]> =>
      koan.makeCExpr("ctrl/ite", [cond, then_, else_]),
  },
  kinds: {
    "ctrl/ite": {
      inputs: [false, 0, 0],
      output: 0,
    } as KindSpec<[boolean, number, number], number>,
  },
  traits: {},
  lifts: {},
  nodeKinds: ["ctrl/ite"] as const,
} satisfies Plugin;

const appC = koan.createApp(
  koan.numPluginU,
  koan.strPluginU,
  koan.boolPluginU,
  koan.ordPlugin,
  itePlugin,
);

function withIteHandler() {
  const { interp } = createTestInterp();
  interp["ctrl/ite"] = async function* () {
    const cond = yield 0;
    if (cond) return yield 1;
    return yield 2;
  } as Handler;
  return interp;
}

describe("mapWhere type safety", () => {
  it("runtime corruption: mapping eq(bool) -> add(number) breaks ite cond", async () => {
    const prog = appC(itePlugin.ctors.ite(koan.eq(1, 2), 10, 20));
    const mapped = koan.mapWhere(prog, koan.byKind("num/eq"), (entry) => ({
      kind: "num/add",
      children: entry.children,
      out: 0,
    }));
    const result = await koan.fold(koan.commit(mapped), withIteHandler());
    expect(result).toBe(10);
  });

  it("runtime corruption: mapping literal number to bool causes NaN in add", async () => {
    const prog = appC(koan.add(2, 3));
    const mapped = koan.mapWhere(prog, koan.byKind("num/literal"), (entry) => ({
      kind: "bool/literal",
      children: entry.children,
      out: true,
    }));
    const result = await koan.fold(koan.commit(mapped), withIteHandler());
    expect(result).toBe(2);
  });
});

const goodProg = appC(itePlugin.ctors.ite(koan.eq(1, 1), 10, 20));
const goodMap = koan.mapWhere(goodProg, koan.byKind("num/add"), (entry) => ({
  kind: "num/sub",
  children: entry.children,
  out: entry.out,
}));
const _goodDirty: DirtyExpr<any, any, any, any> = goodMap;
const _goodExpr: NExpr<any, any, any, any> = koan.commit(goodMap);

const badMap = koan.mapWhere(goodProg, koan.byKind("num/eq"), (entry) => ({
  kind: "num/add",
  children: entry.children,
  out: 0,
}));
// @ts-expect-error mapWhere now returns MapTypeError for output mismatches
const _badDirty: DirtyExpr<any, any, any, any> = badMap;
