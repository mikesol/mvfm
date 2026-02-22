/**
 * Tests for expanded bool/ord plugin ops and neq variants.
 */
import { describe, expect, test } from "vitest";
import type { RuntimeEntry } from "../src/index";
import { boolPlugin, defaults, fold, numPlugin, ordPlugin, strPlugin } from "../src/index";

// ─── Bool plugin tests ──────────────────────────────────────────────

describe("boolPlugin", () => {
  const interp = defaults([boolPlugin]);

  test("bool/and: true && true = true", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "bool/literal", children: [], out: true },
      b: { kind: "bool/literal", children: [], out: true },
      r: { kind: "bool/and", children: ["a", "b"], out: undefined },
    };
    expect(await fold<boolean>("r", adj, interp)).toBe(true);
  });

  test("bool/and: true && false = false", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "bool/literal", children: [], out: true },
      b: { kind: "bool/literal", children: [], out: false },
      r: { kind: "bool/and", children: ["a", "b"], out: undefined },
    };
    expect(await fold<boolean>("r", adj, interp)).toBe(false);
  });

  test("bool/or: false || true = true", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "bool/literal", children: [], out: false },
      b: { kind: "bool/literal", children: [], out: true },
      r: { kind: "bool/or", children: ["a", "b"], out: undefined },
    };
    expect(await fold<boolean>("r", adj, interp)).toBe(true);
  });

  test("bool/or: false || false = false", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "bool/literal", children: [], out: false },
      b: { kind: "bool/literal", children: [], out: false },
      r: { kind: "bool/or", children: ["a", "b"], out: undefined },
    };
    expect(await fold<boolean>("r", adj, interp)).toBe(false);
  });

  test("bool/not: !true = false", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "bool/literal", children: [], out: true },
      r: { kind: "bool/not", children: ["a"], out: undefined },
    };
    expect(await fold<boolean>("r", adj, interp)).toBe(false);
  });

  test("bool/not: !false = true", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "bool/literal", children: [], out: false },
      r: { kind: "bool/not", children: ["a"], out: undefined },
    };
    expect(await fold<boolean>("r", adj, interp)).toBe(true);
  });

  test("bool/implies: true => false = false", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "bool/literal", children: [], out: true },
      b: { kind: "bool/literal", children: [], out: false },
      r: { kind: "bool/implies", children: ["a", "b"], out: undefined },
    };
    expect(await fold<boolean>("r", adj, interp)).toBe(false);
  });

  test("bool/implies: false => false = true", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "bool/literal", children: [], out: false },
      b: { kind: "bool/literal", children: [], out: false },
      r: { kind: "bool/implies", children: ["a", "b"], out: undefined },
    };
    expect(await fold<boolean>("r", adj, interp)).toBe(true);
  });

  test("bool/show: true => 'true'", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "bool/literal", children: [], out: true },
      r: { kind: "bool/show", children: ["a"], out: undefined },
    };
    expect(await fold<string>("r", adj, interp)).toBe("true");
  });

  test("bool/show: false => 'false'", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "bool/literal", children: [], out: false },
      r: { kind: "bool/show", children: ["a"], out: undefined },
    };
    expect(await fold<string>("r", adj, interp)).toBe("false");
  });

  test("bool/tt => true", async () => {
    const adj: Record<string, RuntimeEntry> = {
      r: { kind: "bool/tt", children: [], out: undefined },
    };
    expect(await fold<boolean>("r", adj, interp)).toBe(true);
  });

  test("bool/ff => false", async () => {
    const adj: Record<string, RuntimeEntry> = {
      r: { kind: "bool/ff", children: [], out: undefined },
    };
    expect(await fold<boolean>("r", adj, interp)).toBe(false);
  });

  test("bool/neq: true !== false = true", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "bool/literal", children: [], out: true },
      b: { kind: "bool/literal", children: [], out: false },
      r: { kind: "bool/neq", children: ["a", "b"], out: undefined },
    };
    expect(await fold<boolean>("r", adj, interp)).toBe(true);
  });

  test("bool/neq: true !== true = false", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "bool/literal", children: [], out: true },
      b: { kind: "bool/literal", children: [], out: true },
      r: { kind: "bool/neq", children: ["a", "b"], out: undefined },
    };
    expect(await fold<boolean>("r", adj, interp)).toBe(false);
  });
});

// ─── Ord plugin tests ───────────────────────────────────────────────

describe("ordPlugin", () => {
  const interp = defaults([numPlugin, strPlugin, ordPlugin]);

  test("num/gt: 5 > 3 = true", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 5 },
      b: { kind: "num/literal", children: [], out: 3 },
      r: { kind: "num/gt", children: ["a", "b"], out: undefined },
    };
    expect(await fold<boolean>("r", adj, interp)).toBe(true);
  });

  test("num/gt: 3 > 5 = false", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 3 },
      b: { kind: "num/literal", children: [], out: 5 },
      r: { kind: "num/gt", children: ["a", "b"], out: undefined },
    };
    expect(await fold<boolean>("r", adj, interp)).toBe(false);
  });

  test("num/gte: 5 >= 5 = true", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 5 },
      b: { kind: "num/literal", children: [], out: 5 },
      r: { kind: "num/gte", children: ["a", "b"], out: undefined },
    };
    expect(await fold<boolean>("r", adj, interp)).toBe(true);
  });

  test("num/lte: 3 <= 5 = true", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 3 },
      b: { kind: "num/literal", children: [], out: 5 },
      r: { kind: "num/lte", children: ["a", "b"], out: undefined },
    };
    expect(await fold<boolean>("r", adj, interp)).toBe(true);
  });

  test("num/lte: 5 <= 3 = false", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 5 },
      b: { kind: "num/literal", children: [], out: 3 },
      r: { kind: "num/lte", children: ["a", "b"], out: undefined },
    };
    expect(await fold<boolean>("r", adj, interp)).toBe(false);
  });

  test("str/gt: 'b' > 'a' = true", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "str/literal", children: [], out: "b" },
      b: { kind: "str/literal", children: [], out: "a" },
      r: { kind: "str/gt", children: ["a", "b"], out: undefined },
    };
    expect(await fold<boolean>("r", adj, interp)).toBe(true);
  });

  test("str/gte: 'a' >= 'a' = true", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "str/literal", children: [], out: "a" },
      b: { kind: "str/literal", children: [], out: "a" },
      r: { kind: "str/gte", children: ["a", "b"], out: undefined },
    };
    expect(await fold<boolean>("r", adj, interp)).toBe(true);
  });

  test("str/lt: 'a' < 'b' = true", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "str/literal", children: [], out: "a" },
      b: { kind: "str/literal", children: [], out: "b" },
      r: { kind: "str/lt", children: ["a", "b"], out: undefined },
    };
    expect(await fold<boolean>("r", adj, interp)).toBe(true);
  });

  test("str/lte: 'a' <= 'a' = true", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "str/literal", children: [], out: "a" },
      b: { kind: "str/literal", children: [], out: "a" },
      r: { kind: "str/lte", children: ["a", "b"], out: undefined },
    };
    expect(await fold<boolean>("r", adj, interp)).toBe(true);
  });

  test("str/compare: 'a' < 'b' = -1", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "str/literal", children: [], out: "a" },
      b: { kind: "str/literal", children: [], out: "b" },
      r: { kind: "str/compare", children: ["a", "b"], out: undefined },
    };
    expect(await fold<number>("r", adj, interp)).toBe(-1);
  });

  test("str/compare: 'b' > 'a' = 1", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "str/literal", children: [], out: "b" },
      b: { kind: "str/literal", children: [], out: "a" },
      r: { kind: "str/compare", children: ["a", "b"], out: undefined },
    };
    expect(await fold<number>("r", adj, interp)).toBe(1);
  });

  test("str/compare: 'a' == 'a' = 0", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "str/literal", children: [], out: "a" },
      b: { kind: "str/literal", children: [], out: "a" },
      r: { kind: "str/compare", children: ["a", "b"], out: undefined },
    };
    expect(await fold<number>("r", adj, interp)).toBe(0);
  });
});

// ─── neq variant tests ──────────────────────────────────────────────

describe("neq variants", () => {
  test("num/neq: 3 !== 4 = true", async () => {
    const interp = defaults([numPlugin]);
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 3 },
      b: { kind: "num/literal", children: [], out: 4 },
      r: { kind: "num/neq", children: ["a", "b"], out: undefined },
    };
    expect(await fold<boolean>("r", adj, interp)).toBe(true);
  });

  test("num/neq: 3 !== 3 = false", async () => {
    const interp = defaults([numPlugin]);
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 3 },
      b: { kind: "num/literal", children: [], out: 3 },
      r: { kind: "num/neq", children: ["a", "b"], out: undefined },
    };
    expect(await fold<boolean>("r", adj, interp)).toBe(false);
  });

  test("str/neq: 'a' !== 'b' = true", async () => {
    const interp = defaults([strPlugin]);
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "str/literal", children: [], out: "a" },
      b: { kind: "str/literal", children: [], out: "b" },
      r: { kind: "str/neq", children: ["a", "b"], out: undefined },
    };
    expect(await fold<boolean>("r", adj, interp)).toBe(true);
  });

  test("str/neq: 'a' !== 'a' = false", async () => {
    const interp = defaults([strPlugin]);
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "str/literal", children: [], out: "a" },
      b: { kind: "str/literal", children: [], out: "a" },
      r: { kind: "str/neq", children: ["a", "b"], out: undefined },
    };
    expect(await fold<boolean>("r", adj, interp)).toBe(false);
  });
});
