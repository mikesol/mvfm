import { describe, expect, test } from "vitest";
import {
  defaults,
  fold,
  type Interpreter,
  type RuntimeEntry,
  stdPlugins,
  strLit,
} from "../../src/index";

/** Reusable concat interpreter for manual adj tests. */
const strConcatInterp: Interpreter = {
  "str/literal": async function* (entry) {
    return entry.out as string;
  },
  "str/concat": async function* (entry) {
    const parts: string[] = [];
    for (let i = 0; i < entry.children.length; i++) {
      parts.push((yield i) as string);
    }
    return parts.join("");
  },
};

describe("string golden tests", () => {
  const interp = defaults(stdPlugins);

  describe("string literals", () => {
    test("str/literal evaluates to its string value", async () => {
      const adj: Record<string, RuntimeEntry> = {
        a: { kind: "str/literal", children: [], out: "hello" },
      };
      const result = await fold<string>("a", adj, interp);
      expect(result).toBe("hello");
    });

    test("empty string literal", async () => {
      const adj: Record<string, RuntimeEntry> = {
        a: { kind: "str/literal", children: [], out: "" },
      };
      const result = await fold<string>("a", adj, interp);
      expect(result).toBe("");
    });

    test("string with special characters", async () => {
      const adj: Record<string, RuntimeEntry> = {
        a: {
          kind: "str/literal",
          children: [],
          out: 'line1\nline2\ttab "quotes" \\backslash',
        },
      };
      const result = await fold<string>("a", adj, interp);
      expect(result).toBe('line1\nline2\ttab "quotes" \\backslash');
    });
  });

  describe("string concat", () => {
    test('concat two strings: "hello" + " world"', async () => {
      const adj: Record<string, RuntimeEntry> = {
        a: { kind: "str/literal", children: [], out: "hello" },
        b: { kind: "str/literal", children: [], out: " world" },
        c: { kind: "str/concat", children: ["a", "b"], out: undefined },
      };
      const result = await fold<string>("c", adj, strConcatInterp);
      expect(result).toBe("hello world");
    });

    test("concat three strings", async () => {
      const adj: Record<string, RuntimeEntry> = {
        a: { kind: "str/literal", children: [], out: "hello" },
        b: { kind: "str/literal", children: [], out: " " },
        c: { kind: "str/literal", children: [], out: "world" },
        d: { kind: "str/concat", children: ["a", "b", "c"], out: undefined },
      };
      const result = await fold<string>("d", adj, strConcatInterp);
      expect(result).toBe("hello world");
    });

    test("concat with empty string is identity", async () => {
      const adj: Record<string, RuntimeEntry> = {
        a: { kind: "str/literal", children: [], out: "hello" },
        b: { kind: "str/literal", children: [], out: "" },
        c: { kind: "str/concat", children: ["a", "b"], out: undefined },
      };
      const result = await fold<string>("c", adj, strConcatInterp);
      expect(result).toBe("hello");
    });

    test("concat single string (identity)", async () => {
      const adj: Record<string, RuntimeEntry> = {
        a: { kind: "str/literal", children: [], out: "only" },
        b: { kind: "str/concat", children: ["a"], out: undefined },
      };
      const result = await fold<string>("b", adj, strConcatInterp);
      expect(result).toBe("only");
    });

    test("nested concat (concat of concats)", async () => {
      const adj: Record<string, RuntimeEntry> = {
        a: { kind: "str/literal", children: [], out: "a" },
        b: { kind: "str/literal", children: [], out: "b" },
        c: { kind: "str/concat", children: ["a", "b"], out: undefined },
        d: { kind: "str/literal", children: [], out: "c" },
        e: { kind: "str/literal", children: [], out: "d" },
        f: { kind: "str/concat", children: ["d", "e"], out: undefined },
        g: { kind: "str/concat", children: ["c", "f"], out: undefined },
      };
      const result = await fold<string>("g", adj, strConcatInterp);
      expect(result).toBe("abcd");
    });
  });

  describe("mixed types", () => {
    test("program with both num and str nodes", async () => {
      const adj: Record<string, RuntimeEntry> = {
        a: { kind: "num/literal", children: [], out: 42 },
        b: { kind: "str/literal", children: [], out: "hello" },
      };
      const numResult = await fold<number>("a", adj, interp);
      const strResult = await fold<string>("b", adj, interp);
      expect(numResult).toBe(42);
      expect(strResult).toBe("hello");
    });

    test("str and num in same fold with combined interpreter", async () => {
      const adj: Record<string, RuntimeEntry> = {
        a: { kind: "num/literal", children: [], out: 3 },
        b: { kind: "num/literal", children: [], out: 4 },
        c: { kind: "num/add", children: ["a", "b"], out: undefined },
        d: { kind: "str/literal", children: [], out: "result" },
      };
      const numResult = await fold<number>("c", adj, interp);
      const strResult = await fold<string>("d", adj, interp);
      expect(numResult).toBe(7);
      expect(strResult).toBe("result");
    });

    test("strLit is a passthrough", () => {
      expect(strLit("hello")).toBe("hello");
      expect(strLit("")).toBe("");
      expect(strLit("special\nchars")).toBe("special\nchars");
    });
  });

  describe("memoization with strings", () => {
    test("shared string node evaluated once", async () => {
      let evalCount = 0;
      const countingInterp: Interpreter = {
        "str/literal": async function* (entry) {
          evalCount++;
          return entry.out as string;
        },
        "str/concat": async function* (entry) {
          const parts: string[] = [];
          for (let i = 0; i < entry.children.length; i++) {
            parts.push((yield i) as string);
          }
          return parts.join("");
        },
      };
      const adj: Record<string, RuntimeEntry> = {
        a: { kind: "str/literal", children: [], out: "x" },
        b: { kind: "str/concat", children: ["a", "a"], out: undefined },
      };
      evalCount = 0;
      const result = await fold<string>("b", adj, countingInterp);
      expect(result).toBe("xx");
      expect(evalCount).toBe(1);
    });

    test("diamond with string nodes", async () => {
      let litEvals = 0;
      const countingInterp: Interpreter = {
        "str/literal": async function* (entry) {
          litEvals++;
          return entry.out as string;
        },
        "str/concat": async function* (entry) {
          const parts: string[] = [];
          for (let i = 0; i < entry.children.length; i++) {
            parts.push((yield i) as string);
          }
          return parts.join("");
        },
      };
      // Diamond: A="x", B=concat(A,A)="xx", C=concat(A,A)="xx",
      // D=concat(B,C)="xxxx". A is shared across B and C.
      const adj: Record<string, RuntimeEntry> = {
        a: { kind: "str/literal", children: [], out: "x" },
        b: { kind: "str/concat", children: ["a", "a"], out: undefined },
        c: { kind: "str/concat", children: ["a", "a"], out: undefined },
        d: { kind: "str/concat", children: ["b", "c"], out: undefined },
      };
      litEvals = 0;
      const result = await fold<string>("d", adj, countingInterp);
      expect(result).toBe("xxxx");
      expect(litEvals).toBe(1);
    });
  });

  describe("string interpreter integration", () => {
    test("defaults(stdPlugins) handles str/literal", async () => {
      const adj: Record<string, RuntimeEntry> = {
        a: { kind: "str/literal", children: [], out: "from defaults" },
      };
      const result = await fold<string>("a", adj, interp);
      expect(result).toBe("from defaults");
    });

    test("defaults(stdPlugins) handles str/eq", async () => {
      const adj: Record<string, RuntimeEntry> = {
        a: { kind: "str/literal", children: [], out: "foo" },
        b: { kind: "str/literal", children: [], out: "foo" },
        c: { kind: "str/eq", children: ["a", "b"], out: undefined },
      };
      const result = await fold<boolean>("c", adj, interp);
      expect(result).toBe(true);
    });

    test("str/eq returns false for different strings", async () => {
      const adj: Record<string, RuntimeEntry> = {
        a: { kind: "str/literal", children: [], out: "foo" },
        b: { kind: "str/literal", children: [], out: "bar" },
        c: { kind: "str/eq", children: ["a", "b"], out: undefined },
      };
      const result = await fold<boolean>("c", adj, interp);
      expect(result).toBe(false);
    });

    test("custom string interpreter override", async () => {
      const customInterp: Interpreter = {
        "str/literal": async function* (entry) {
          return `[${entry.out as string}]`;
        },
        "str/concat": async function* (entry) {
          const parts: string[] = [];
          for (let i = 0; i < entry.children.length; i++) {
            parts.push((yield i) as string);
          }
          return parts.join(" + ");
        },
      };
      const adj: Record<string, RuntimeEntry> = {
        a: { kind: "str/literal", children: [], out: "x" },
        b: { kind: "str/literal", children: [], out: "y" },
        c: { kind: "str/concat", children: ["a", "b"], out: undefined },
      };
      const result = await fold<string>("c", adj, customInterp);
      expect(result).toBe("[x] + [y]");
    });
  });

  describe("concat edge cases", () => {
    test("concat with no children produces empty string", async () => {
      const adj: Record<string, RuntimeEntry> = {
        a: { kind: "str/concat", children: [], out: undefined },
      };
      const result = await fold<string>("a", adj, strConcatInterp);
      expect(result).toBe("");
    });

    test("concat many children (5 strings)", async () => {
      const adj: Record<string, RuntimeEntry> = {
        a: { kind: "str/literal", children: [], out: "a" },
        b: { kind: "str/literal", children: [], out: "b" },
        c: { kind: "str/literal", children: [], out: "c" },
        d: { kind: "str/literal", children: [], out: "d" },
        e: { kind: "str/literal", children: [], out: "e" },
        f: {
          kind: "str/concat",
          children: ["a", "b", "c", "d", "e"],
          out: undefined,
        },
      };
      const result = await fold<string>("f", adj, strConcatInterp);
      expect(result).toBe("abcde");
    });
  });

  describe("unicode strings", () => {
    test("str/literal with unicode", async () => {
      const adj: Record<string, RuntimeEntry> = {
        a: { kind: "str/literal", children: [], out: "caf\u00e9" },
      };
      const result = await fold<string>("a", adj, interp);
      expect(result).toBe("caf\u00e9");
    });

    test("concat unicode strings", async () => {
      const adj: Record<string, RuntimeEntry> = {
        a: { kind: "str/literal", children: [], out: "hello " },
        b: { kind: "str/literal", children: [], out: "\u4e16\u754c" },
        c: { kind: "str/concat", children: ["a", "b"], out: undefined },
      };
      const result = await fold<string>("c", adj, strConcatInterp);
      expect(result).toBe("hello \u4e16\u754c");
    });
  });
});
