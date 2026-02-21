import { describe, expect, it } from "vitest";
import type { CExpr, Handler, KindSpec, NExpr, Plugin } from "../src/koan";
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

describe("spliceWhere type safety", () => {
  it("splicing eq in ite cond can flip false -> true", async () => {
    const prog = appC(itePlugin.ctors.ite(koan.eq(2, 3), 10, 20));
    const spliced = koan.spliceWhere(prog, koan.byKind("num/eq"));
    const result = await koan.fold(
      spliced as unknown as NExpr<any, any, any, any>,
      withIteHandler(),
    );
    expect(result).toBe(3);
  });

  it("splicing eq can be accidentally correct when first child is falsy", async () => {
    const prog = appC(itePlugin.ctors.ite(koan.eq(0, 1), 10, 20));
    const spliced = koan.spliceWhere(prog, koan.byKind("num/eq"));
    const result = await koan.fold(
      spliced as unknown as NExpr<any, any, any, any>,
      withIteHandler(),
    );
    expect(result).toBe(10);
  });

  it("splicing add in number position preserves type", async () => {
    const prog = appC(koan.mul(koan.add(1, 2), 10));
    const spliced = koan.spliceWhere(prog, koan.byKind("num/add"));
    const result = await koan.fold(spliced, withIteHandler());
    expect(result).toBe(2);
  });
});

const badSplice = koan.spliceWhere(
  appC(itePlugin.ctors.ite(koan.eq(1, 2), 3, 4)),
  koan.byKind("num/eq"),
);
// @ts-expect-error spliceWhere returns SpliceTypeError when replacement child output mismatches
const _badExpr: NExpr<any, any, any, any> = badSplice;

const okSplice = koan.spliceWhere(appC(koan.mul(koan.add(1, 2), 3)), koan.byKind("num/add"));
const _okExpr: NExpr<any, any, any, any> = okSplice;
