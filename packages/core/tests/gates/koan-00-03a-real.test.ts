import { describe, expect, it } from "vitest";

import { koan } from "../../src/index";

describe("real gate 00-03a: koan core model via @mvfm/core", () => {
  it("builds and detects CExpr", () => {
    const expr = koan.add(1, 2);
    expect(expr.__kind).toBe("num/add");
    expect(koan.isCExpr(expr)).toBe(true);
    expect(koan.isCExpr({})).toBe(false);
  });

  it("increments content-address ids in base-26 style", () => {
    expect(koan.incrementId("a")).toBe("b");
    expect(koan.incrementId("z")).toBe("aa");
    expect(koan.incrementId("az")).toBe("ba");
    expect(koan.incrementId("zz")).toBe("aaa");
  });

  it("composes unified plugins and derived maps", () => {
    const maps = {
      lift: koan.buildLiftMap(koan.stdPlugins),
      traits: koan.buildTraitMap(koan.stdPlugins),
      kindInputs: koan.buildKindInputs(koan.stdPlugins),
    };

    expect(maps.lift.number).toBe("num/literal");
    expect(maps.traits.eq.string).toBe("str/eq");
    expect(maps.kindInputs["num/add"]).toEqual(["number", "number"]);

    const $ = koan.mvfmU(...koan.stdPlugins, koan.ordPlugin);
    expect($.add(1, 2).__kind).toBe("num/add");
    expect($.eq(1, 2).__kind).toBe("eq");
    expect($.lt(1, 2).__kind).toBe("lt");
  });

  it("constructs NExpr with explicit root/adj/counter", () => {
    const n = koan.makeNExpr<
      number,
      "a",
      { a: { kind: "num/literal"; children: []; out: number } },
      "b"
    >(
      "a",
      {
        a: { kind: "num/literal", children: [], out: 1 },
      },
      "b",
    );
    expect(n.__id).toBe("a");
    expect(n.__counter).toBe("b");
  });
});
