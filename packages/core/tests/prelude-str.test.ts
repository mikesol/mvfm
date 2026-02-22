/**
 * Tests for str plugin prelude operations.
 *
 * Each test uses raw adjacency maps (NExpr + fold) to verify handlers.
 */
import { describe, expect, test } from "vitest";
import type { RuntimeEntry } from "../src/index";
import { defaults, fold, strPlugin } from "../src/index";

const interp = defaults([strPlugin]);

describe("str/concat", () => {
  test("concatenates multiple strings", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "str/literal", children: [], out: "hello" },
      b: { kind: "str/literal", children: [], out: " " },
      c: { kind: "str/literal", children: [], out: "world" },
      d: { kind: "str/concat", children: ["a", "b", "c"], out: undefined },
    };
    expect(await fold<string>("d", adj, interp)).toBe("hello world");
  });

  test("empty concat returns empty string", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "str/concat", children: [], out: undefined },
    };
    expect(await fold<string>("a", adj, interp)).toBe("");
  });
});

describe("str/upper", () => {
  test("converts to uppercase", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "str/literal", children: [], out: "hello" },
      b: { kind: "str/upper", children: ["a"], out: undefined },
    };
    expect(await fold<string>("b", adj, interp)).toBe("HELLO");
  });
});

describe("str/lower", () => {
  test("converts to lowercase", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "str/literal", children: [], out: "HELLO" },
      b: { kind: "str/lower", children: ["a"], out: undefined },
    };
    expect(await fold<string>("b", adj, interp)).toBe("hello");
  });
});

describe("str/trim", () => {
  test("trims whitespace", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "str/literal", children: [], out: "  hello  " },
      b: { kind: "str/trim", children: ["a"], out: undefined },
    };
    expect(await fold<string>("b", adj, interp)).toBe("hello");
  });
});

describe("str/slice", () => {
  test("slices with start and end", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "str/literal", children: [], out: "hello world" },
      b: { kind: "num/literal", children: [], out: 0 },
      c: { kind: "num/literal", children: [], out: 5 },
      d: { kind: "str/slice", children: ["a", "b", "c"], out: undefined },
    };
    // num/literal handler needed
    const numLitH = {
      "num/literal": async function* (e: RuntimeEntry) {
        return e.out as number;
      },
    };
    expect(await fold<string>("d", adj, { ...interp, ...numLitH })).toBe("hello");
  });

  test("slices with start only", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "str/literal", children: [], out: "hello world" },
      b: { kind: "num/literal", children: [], out: 6 },
      d: { kind: "str/slice", children: ["a", "b"], out: undefined },
    };
    const numLitH = {
      "num/literal": async function* (e: RuntimeEntry) {
        return e.out as number;
      },
    };
    expect(await fold<string>("d", adj, { ...interp, ...numLitH })).toBe("world");
  });
});

describe("str/includes", () => {
  test("returns true when substring found", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "str/literal", children: [], out: "hello world" },
      b: { kind: "str/literal", children: [], out: "world" },
      c: { kind: "str/includes", children: ["a", "b"], out: undefined },
    };
    expect(await fold<boolean>("c", adj, interp)).toBe(true);
  });

  test("returns false when substring not found", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "str/literal", children: [], out: "hello" },
      b: { kind: "str/literal", children: [], out: "xyz" },
      c: { kind: "str/includes", children: ["a", "b"], out: undefined },
    };
    expect(await fold<boolean>("c", adj, interp)).toBe(false);
  });
});

describe("str/startsWith", () => {
  test("returns true for matching prefix", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "str/literal", children: [], out: "hello world" },
      b: { kind: "str/literal", children: [], out: "hello" },
      c: { kind: "str/startsWith", children: ["a", "b"], out: undefined },
    };
    expect(await fold<boolean>("c", adj, interp)).toBe(true);
  });

  test("returns false for non-matching prefix", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "str/literal", children: [], out: "hello" },
      b: { kind: "str/literal", children: [], out: "world" },
      c: { kind: "str/startsWith", children: ["a", "b"], out: undefined },
    };
    expect(await fold<boolean>("c", adj, interp)).toBe(false);
  });
});

describe("str/endsWith", () => {
  test("returns true for matching suffix", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "str/literal", children: [], out: "hello world" },
      b: { kind: "str/literal", children: [], out: "world" },
      c: { kind: "str/endsWith", children: ["a", "b"], out: undefined },
    };
    expect(await fold<boolean>("c", adj, interp)).toBe(true);
  });
});

describe("str/split", () => {
  test("splits string by separator", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "str/literal", children: [], out: "a,b,c" },
      b: { kind: "str/literal", children: [], out: "," },
      c: { kind: "str/split", children: ["a", "b"], out: undefined },
    };
    expect(await fold<string[]>("c", adj, interp)).toEqual(["a", "b", "c"]);
  });
});

describe("str/join", () => {
  test("joins array with separator", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "str/split", children: ["x", "y"], out: undefined },
      x: { kind: "str/literal", children: [], out: "a-b-c" },
      y: { kind: "str/literal", children: [], out: "-" },
      sep: { kind: "str/literal", children: [], out: ", " },
      r: { kind: "str/join", children: ["a", "sep"], out: undefined },
    };
    expect(await fold<string>("r", adj, interp)).toBe("a, b, c");
  });
});

describe("str/replace", () => {
  test("replaces first occurrence", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "str/literal", children: [], out: "hello world" },
      b: { kind: "str/literal", children: [], out: "world" },
      c: { kind: "str/literal", children: [], out: "there" },
      d: { kind: "str/replace", children: ["a", "b", "c"], out: undefined },
    };
    expect(await fold<string>("d", adj, interp)).toBe("hello there");
  });
});

describe("str/len", () => {
  test("returns string length", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "str/literal", children: [], out: "hello" },
      b: { kind: "str/len", children: ["a"], out: undefined },
    };
    expect(await fold<number>("b", adj, interp)).toBe(5);
  });

  test("empty string has length 0", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "str/literal", children: [], out: "" },
      b: { kind: "str/len", children: ["a"], out: undefined },
    };
    expect(await fold<number>("b", adj, interp)).toBe(0);
  });
});

describe("str/show", () => {
  test("returns string identity", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "str/literal", children: [], out: "hello" },
      b: { kind: "str/show", children: ["a"], out: undefined },
    };
    expect(await fold<string>("b", adj, interp)).toBe("hello");
  });
});

describe("str/append", () => {
  test("appends two strings", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "str/literal", children: [], out: "hello" },
      b: { kind: "str/literal", children: [], out: " world" },
      c: { kind: "str/append", children: ["a", "b"], out: undefined },
    };
    expect(await fold<string>("c", adj, interp)).toBe("hello world");
  });
});

describe("str/mempty", () => {
  test("returns empty string", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "str/mempty", children: [], out: undefined },
    };
    expect(await fold<string>("a", adj, interp)).toBe("");
  });
});

describe("str/eq and str/neq", () => {
  test("eq returns true for equal strings", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "str/literal", children: [], out: "hello" },
      b: { kind: "str/literal", children: [], out: "hello" },
      c: { kind: "str/eq", children: ["a", "b"], out: undefined },
    };
    expect(await fold<boolean>("c", adj, interp)).toBe(true);
  });

  test("neq returns true for different strings", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "str/literal", children: [], out: "hello" },
      b: { kind: "str/literal", children: [], out: "world" },
      c: { kind: "str/neq", children: ["a", "b"], out: undefined },
    };
    expect(await fold<boolean>("c", adj, interp)).toBe(true);
  });
});
