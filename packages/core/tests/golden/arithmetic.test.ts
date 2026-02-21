import { describe, expect, test } from "vitest";
import {
  add,
  app,
  defaults,
  fold,
  type Interpreter,
  mul,
  numLit,
  type RuntimeEntry,
  stdPlugins,
  sub,
} from "../../src/index";

describe("arithmetic golden tests", () => {
  const interp = defaults(stdPlugins);

  describe("basic operations", () => {
    test("add(3, 4) = 7", async () => {
      const result = await fold(app(add(3, 4)), interp);
      expect(result).toBe(7);
    });

    test("sub(10, 3) = 7", async () => {
      const result = await fold(app(sub(10, 3)), interp);
      expect(result).toBe(7);
    });

    test("mul(6, 7) = 42", async () => {
      const result = await fold(app(mul(6, 7)), interp);
      expect(result).toBe(42);
    });

    test("add(1, 1) = 2", async () => {
      const result = await fold(app(add(1, 1)), interp);
      expect(result).toBe(2);
    });

    test("sub(100, 1) = 99", async () => {
      const result = await fold(app(sub(100, 1)), interp);
      expect(result).toBe(99);
    });

    test("mul(2, 2) = 4", async () => {
      const result = await fold(app(mul(2, 2)), interp);
      expect(result).toBe(4);
    });
  });

  describe("nested arithmetic", () => {
    test("add(mul(2, 3), sub(10, 4)) = 12", async () => {
      const result = await fold(app(add(mul(2, 3), sub(10, 4))), interp);
      expect(result).toBe(12);
    });

    test("mul(add(1, 2), add(3, 4)) = 21", async () => {
      const result = await fold(app(mul(add(1, 2), add(3, 4))), interp);
      expect(result).toBe(21);
    });

    test("sub(mul(5, 5), add(10, 10)) = 5", async () => {
      const result = await fold(app(sub(mul(5, 5), add(10, 10))), interp);
      expect(result).toBe(5);
    });

    test("add(add(1, 2), add(3, 4)) = 10", async () => {
      const result = await fold(app(add(add(1, 2), add(3, 4))), interp);
      expect(result).toBe(10);
    });
  });

  describe("deep nesting (5+ levels)", () => {
    test("mul(add(sub(1,2), mul(3,4)), add(5, sub(6,7))) = -4", async () => {
      // sub(1,2)=-1, mul(3,4)=12, add(-1,12)=11
      // sub(6,7)=-1, add(5,-1)=4
      // mul(11, 4) = 44
      const result = await fold(app(mul(add(sub(1, 2), mul(3, 4)), add(5, sub(6, 7)))), interp);
      expect(result).toBe(44);
    });

    test("add(mul(add(1,2), sub(8,3)), mul(2, add(3, mul(2,2)))) = 29", async () => {
      // add(1,2)=3, sub(8,3)=5, mul(3,5)=15
      // mul(2,2)=4, add(3,4)=7, mul(2,7)=14
      // add(15,14) = 29
      const result = await fold(
        app(add(mul(add(1, 2), sub(8, 3)), mul(2, add(3, mul(2, 2))))),
        interp,
      );
      expect(result).toBe(29);
    });
  });

  describe("zero identity", () => {
    test("add(0, 5) = 5", async () => {
      const result = await fold(app(add(0, 5)), interp);
      expect(result).toBe(5);
    });

    test("add(5, 0) = 5", async () => {
      const result = await fold(app(add(5, 0)), interp);
      expect(result).toBe(5);
    });

    test("mul(0, 5) = 0", async () => {
      const result = await fold(app(mul(0, 5)), interp);
      expect(result).toBe(0);
    });

    test("mul(5, 0) = 0", async () => {
      const result = await fold(app(mul(5, 0)), interp);
      expect(result).toBe(0);
    });

    test("sub(5, 0) = 5", async () => {
      const result = await fold(app(sub(5, 0)), interp);
      expect(result).toBe(5);
    });
  });

  describe("one identity", () => {
    test("mul(1, 42) = 42", async () => {
      const result = await fold(app(mul(1, 42)), interp);
      expect(result).toBe(42);
    });

    test("mul(42, 1) = 42", async () => {
      const result = await fold(app(mul(42, 1)), interp);
      expect(result).toBe(42);
    });
  });

  describe("negative results", () => {
    test("sub(3, 10) = -7", async () => {
      const result = await fold(app(sub(3, 10)), interp);
      expect(result).toBe(-7);
    });

    test("mul(sub(0, 3), 4) = -12", async () => {
      const result = await fold(app(mul(sub(0, 3), 4)), interp);
      expect(result).toBe(-12);
    });

    test("add(sub(0, 10), sub(0, 20)) = -30", async () => {
      const result = await fold(app(add(sub(0, 10), sub(0, 20))), interp);
      expect(result).toBe(-30);
    });
  });

  describe("large numbers", () => {
    test("add(1000000, 2000000) = 3000000", async () => {
      const result = await fold(app(add(1000000, 2000000)), interp);
      expect(result).toBe(3000000);
    });

    test("mul(10000, 10000) = 100000000", async () => {
      const result = await fold(app(mul(10000, 10000)), interp);
      expect(result).toBe(100000000);
    });
  });

  describe("same value operations", () => {
    test("sub(5, 5) = 0", async () => {
      const result = await fold(app(sub(5, 5)), interp);
      expect(result).toBe(0);
    });

    test("sub(999, 999) = 0", async () => {
      const result = await fold(app(sub(999, 999)), interp);
      expect(result).toBe(0);
    });
  });

  describe("numLit passthrough", () => {
    test("numLit returns the number itself", () => {
      expect(numLit(42)).toBe(42);
      expect(numLit(0)).toBe(0);
      expect(numLit(-7)).toBe(-7);
    });
  });

  describe("NExpr structure", () => {
    test("app(add(3,4)) has 3 entries with sequential IDs", () => {
      const prog = app(add(3, 4));
      expect(prog.__id).toBe("c");
      expect(prog.__adj.a.kind).toBe("num/literal");
      expect(prog.__adj.b.kind).toBe("num/literal");
      expect(prog.__adj.c.kind).toBe("num/add");
      expect(prog.__adj.c.children).toEqual(["a", "b"]);
    });

    test("app(mul(add(3,4),5)) has 5 entries with root 'e'", () => {
      const prog = app(mul(add(3, 4), 5));
      expect(prog.__id).toBe("e");
      expect(Object.keys(prog.__adj)).toHaveLength(5);
      expect(prog.__adj.e.kind).toBe("num/mul");
    });
  });

  describe("DAG sharing (memoization)", () => {
    test("shared subexpr evaluated once", async () => {
      let evalCount = 0;
      const countingInterp: Interpreter = {
        "num/literal": async function* (entry) {
          evalCount++;
          return entry.out as number;
        },
        "num/add": async function* (_entry) {
          const l = (yield 0) as number;
          const r = (yield 1) as number;
          return l + r;
        },
      };
      const sharedAdj: Record<string, RuntimeEntry> = {
        a: { kind: "num/literal", children: [], out: 5 },
        b: { kind: "num/add", children: ["a", "a"], out: undefined },
      };
      evalCount = 0;
      const result = await fold<number>("b", sharedAdj, countingInterp);
      expect(result).toBe(10);
      expect(evalCount).toBe(1);
    });
  });

  describe("diamond pattern", () => {
    test("A used by B and C, both used by D — correct result, A evaluated once", async () => {
      let aEvals = 0;
      const countingInterp: Interpreter = {
        "num/literal": async function* (entry) {
          aEvals++;
          return entry.out as number;
        },
        "num/add": async function* (_entry) {
          const l = (yield 0) as number;
          const r = (yield 1) as number;
          return l + r;
        },
        "num/mul": async function* (_entry) {
          const l = (yield 0) as number;
          const r = (yield 1) as number;
          return l * r;
        },
      };
      // Diamond: A=3, B=add(A,A)=6, C=mul(A,A)=9, D=add(B,C)=15
      const diamondAdj: Record<string, RuntimeEntry> = {
        a: { kind: "num/literal", children: [], out: 3 },
        b: { kind: "num/add", children: ["a", "a"], out: undefined },
        c: { kind: "num/mul", children: ["a", "a"], out: undefined },
        d: { kind: "num/add", children: ["b", "c"], out: undefined },
      };
      aEvals = 0;
      const result = await fold<number>("d", diamondAdj, countingInterp);
      expect(result).toBe(15);
      expect(aEvals).toBe(1);
    });
  });
});
