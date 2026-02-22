import { describe, expect, test } from "vitest";
import { fold, type Interpreter, type RuntimeEntry } from "../../src/index";

type Result<T> = { ok: T; err: null } | { ok: null; err: unknown };
const ok = <T>(v: T): Result<T> => ({ ok: v, err: null });
const err = <T>(e: unknown): Result<T> => ({ ok: null, err: e });
type Adj = Record<string, RuntimeEntry>;
const n = (kind: string, children: string[], out?: unknown): RuntimeEntry => ({
  kind,
  children,
  out,
});

const lit: Interpreter = {
  "num/literal": async function* (e) {
    return e.out as number;
  },
  "str/literal": async function* (e) {
    return e.out as string;
  },
  "bool/literal": async function* (e) {
    return e.out as boolean;
  },
};
const failH: Interpreter = {
  "error/fail": async function* (e) {
    throw new Error(e.out as string);
  },
};
const wrapH: Interpreter = {
  wrap: async function* () {
    return yield 0;
  },
};

describe("error handling", () => {
  describe("basic error propagation", () => {
    test("handler that throws rejects fold", async () => {
      const adj: Adj = { a: n("error/fail", [], "something went wrong") };
      await expect(fold("a", adj, failH)).rejects.toThrow("something went wrong");
    });

    test("throw in child propagates past parent", async () => {
      const adj: Adj = {
        a: n("error/fail", [], "child error"),
        b: n("wrap", ["a"]),
      };
      await expect(fold("b", adj, { ...failH, ...wrapH })).rejects.toThrow("child error");
    });

    test("throw in nested child propagates up through chain", async () => {
      const adj: Adj = {
        a: n("error/fail", [], "deep error"),
        b: n("wrap", ["a"]),
        c: n("wrap", ["b"]),
        d: n("wrap", ["c"]),
      };
      await expect(fold("d", adj, { ...failH, ...wrapH })).rejects.toThrow("deep error");
    });

    test("non-Error throw propagates", async () => {
      const adj: Adj = { a: n("error/throw-string", [], "raw string") };
      const interp: Interpreter = {
        "error/throw-string": async function* (e) {
          throw e.out;
        },
      };
      await expect(fold("a", adj, interp)).rejects.toBe("raw string");
    });

    test("first child to throw wins", async () => {
      const adj: Adj = {
        a: n("error/fail", [], "first"),
        b: n("num/literal", [], 42),
        c: n("seq", ["a", "b"]),
      };
      const interp: Interpreter = {
        ...lit,
        ...failH,
        seq: async function* () {
          const l = yield 0;
          const r = yield 1;
          return [l, r];
        },
      };
      await expect(fold("c", adj, interp)).rejects.toThrow("first");
    });
  });

  // Value-level error handling via Result types (fold lacks gen.throw)
  describe("result-based try/catch", () => {
    const resultInterp: Interpreter = {
      ...lit,
      "error/fail": async function* (e) {
        return err(new Error(e.out as string));
      },
      "result/try": async function* () {
        const body = (yield 0) as Result<unknown>;
        return body.err !== null ? yield 1 : body.ok;
      },
      "result/ok": async function* () {
        return ok(yield 0);
      },
    };

    test("try with successful body returns body result", async () => {
      const adj: Adj = {
        a: n("num/literal", [], 42),
        body: n("result/ok", ["a"]),
        fallback: n("num/literal", [], -1),
        root: n("result/try", ["body", "fallback"]),
      };
      expect(await fold("root", adj, resultInterp)).toBe(42);
    });

    test("try with failing body returns catch result", async () => {
      const adj: Adj = {
        body: n("error/fail", [], "oops"),
        fallback: n("num/literal", [], -1),
        root: n("result/try", ["body", "fallback"]),
      };
      expect(await fold("root", adj, resultInterp)).toBe(-1);
    });

    test("nested try/catch: inner catches, outer sees success", async () => {
      const adj: Adj = {
        failing: n("error/fail", [], "inner fail"),
        innerFb: n("num/literal", [], 99),
        inner: n("result/try", ["failing", "innerFb"]),
        outerBody: n("result/ok", ["inner"]),
        outerFb: n("num/literal", [], -999),
        root: n("result/try", ["outerBody", "outerFb"]),
      };
      expect(await fold("root", adj, resultInterp)).toBe(99);
    });

    test("catch branch not evaluated on success", async () => {
      let catchEvaluated = false;
      const adj: Adj = {
        a: n("num/literal", [], 7),
        body: n("result/ok", ["a"]),
        fallback: n("tracked", []),
        root: n("result/try", ["body", "fallback"]),
      };
      const interp: Interpreter = {
        ...resultInterp,
        tracked: async function* () {
          catchEvaluated = true;
          return -1;
        },
      };
      expect(await fold("root", adj, interp)).toBe(7);
      expect(catchEvaluated).toBe(false);
    });

    test("error propagates through passthrough handler", async () => {
      const adj: Adj = {
        fail: n("error/fail", [], "deep"),
        mid: n("result/passthrough", ["fail"]),
        fallback: n("num/literal", [], 0),
        root: n("result/try", ["mid", "fallback"]),
      };
      const interp: Interpreter = {
        ...resultInterp,
        "result/passthrough": async function* () {
          return (yield 0) as Result<unknown>;
        },
      };
      expect(await fold("root", adj, interp)).toBe(0);
    });
  });
});
