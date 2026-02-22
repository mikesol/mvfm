import { describe, expect, test } from "vitest";
import { defaults, fold, numPlugin, type RuntimeEntry } from "../src/index";

const interp = defaults([numPlugin]);

// Helper to build adjacency map and fold from root
async function evalRoot<T>(adj: Record<string, RuntimeEntry>, root: string): Promise<T> {
  return fold<T>(root, adj, interp);
}

// ── Binary arithmetic ───────────────────────────────────────────────
describe("num binary ops", () => {
  test("div(10, 3) → 10 / 3", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 10 },
      b: { kind: "num/literal", children: [], out: 3 },
      c: { kind: "num/div", children: ["a", "b"], out: undefined },
    };
    expect(await evalRoot<number>(adj, "c")).toBeCloseTo(10 / 3);
  });

  test("mod(10, 3) → 1", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 10 },
      b: { kind: "num/literal", children: [], out: 3 },
      c: { kind: "num/mod", children: ["a", "b"], out: undefined },
    };
    expect(await evalRoot<number>(adj, "c")).toBe(1);
  });

  test("min(7, 3) → 3", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 7 },
      b: { kind: "num/literal", children: [], out: 3 },
      c: { kind: "num/min", children: ["a", "b"], out: undefined },
    };
    expect(await evalRoot<number>(adj, "c")).toBe(3);
  });

  test("max(7, 3) → 7", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 7 },
      b: { kind: "num/literal", children: [], out: 3 },
      c: { kind: "num/max", children: ["a", "b"], out: undefined },
    };
    expect(await evalRoot<number>(adj, "c")).toBe(7);
  });
});

// ── Unary ops ───────────────────────────────────────────────────────
describe("num unary ops", () => {
  test("neg(5) → -5", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 5 },
      b: { kind: "num/neg", children: ["a"], out: undefined },
    };
    expect(await evalRoot<number>(adj, "b")).toBe(-5);
  });

  test("abs(-7) → 7", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: -7 },
      b: { kind: "num/abs", children: ["a"], out: undefined },
    };
    expect(await evalRoot<number>(adj, "b")).toBe(7);
  });

  test("floor(3.7) → 3", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 3.7 },
      b: { kind: "num/floor", children: ["a"], out: undefined },
    };
    expect(await evalRoot<number>(adj, "b")).toBe(3);
  });

  test("ceil(3.2) → 4", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 3.2 },
      b: { kind: "num/ceil", children: ["a"], out: undefined },
    };
    expect(await evalRoot<number>(adj, "b")).toBe(4);
  });

  test("round(3.5) → 4", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 3.5 },
      b: { kind: "num/round", children: ["a"], out: undefined },
    };
    expect(await evalRoot<number>(adj, "b")).toBe(4);
  });

  test("round(3.4) → 3", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 3.4 },
      b: { kind: "num/round", children: ["a"], out: undefined },
    };
    expect(await evalRoot<number>(adj, "b")).toBe(3);
  });
});

// ── Show and compare ────────────────────────────────────────────────
describe("num show and compare", () => {
  test("show(42) → '42'", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 42 },
      b: { kind: "num/show", children: ["a"], out: undefined },
    };
    expect(await evalRoot<string>(adj, "b")).toBe("42");
  });

  test("compare(1, 2) → -1", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 1 },
      b: { kind: "num/literal", children: [], out: 2 },
      c: { kind: "num/compare", children: ["a", "b"], out: undefined },
    };
    expect(await evalRoot<number>(adj, "c")).toBe(-1);
  });

  test("compare(5, 5) → 0", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 5 },
      b: { kind: "num/literal", children: [], out: 5 },
      c: { kind: "num/compare", children: ["a", "b"], out: undefined },
    };
    expect(await evalRoot<number>(adj, "c")).toBe(0);
  });

  test("compare(9, 3) → 1", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 9 },
      b: { kind: "num/literal", children: [], out: 3 },
      c: { kind: "num/compare", children: ["a", "b"], out: undefined },
    };
    expect(await evalRoot<number>(adj, "c")).toBe(1);
  });
});

// ── Nullary constants ───────────────────────────────────────────────
describe("num constants", () => {
  test("zero → 0", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/zero", children: [], out: undefined },
    };
    expect(await evalRoot<number>(adj, "a")).toBe(0);
  });

  test("one → 1", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/one", children: [], out: undefined },
    };
    expect(await evalRoot<number>(adj, "a")).toBe(1);
  });

  test("top → Number.MAX_SAFE_INTEGER", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/top", children: [], out: undefined },
    };
    expect(await evalRoot<number>(adj, "a")).toBe(Number.MAX_SAFE_INTEGER);
  });

  test("bottom → Number.MIN_SAFE_INTEGER", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/bottom", children: [], out: undefined },
    };
    expect(await evalRoot<number>(adj, "a")).toBe(Number.MIN_SAFE_INTEGER);
  });
});

// ── Composition ─────────────────────────────────────────────────────
describe("num composed ops", () => {
  test("abs(neg(3)) → 3", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 3 },
      b: { kind: "num/neg", children: ["a"], out: undefined },
      c: { kind: "num/abs", children: ["b"], out: undefined },
    };
    expect(await evalRoot<number>(adj, "c")).toBe(3);
  });

  test("floor(div(10, 3)) → 3", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 10 },
      b: { kind: "num/literal", children: [], out: 3 },
      c: { kind: "num/div", children: ["a", "b"], out: undefined },
      d: { kind: "num/floor", children: ["c"], out: undefined },
    };
    expect(await evalRoot<number>(adj, "d")).toBe(3);
  });
});
