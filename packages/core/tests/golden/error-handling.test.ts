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

  describe("attempt (Either-style)", () => {
    const attemptInterp: Interpreter = {
      ...lit,
      "error/fail": async function* (e) {
        return err(e.out as string);
      },
      "result/attempt": async function* () {
        return (yield 0) as Result<unknown>;
      },
      "result/ok": async function* () {
        return ok(yield 0);
      },
    };

    test("success returns {ok: value, err: null}", async () => {
      const adj: Adj = {
        a: n("num/literal", [], 42),
        body: n("result/ok", ["a"]),
        root: n("result/attempt", ["body"]),
      };
      expect(await fold("root", adj, attemptInterp)).toEqual({ ok: 42, err: null });
    });

    test("failure returns {ok: null, err: message}", async () => {
      const adj: Adj = {
        body: n("error/fail", [], "bad input"),
        root: n("result/attempt", ["body"]),
      };
      expect(await fold("root", adj, attemptInterp)).toEqual({ ok: null, err: "bad input" });
    });

    test("nested attempt wraps inner result", async () => {
      const adj: Adj = {
        fail: n("error/fail", [], "inner"),
        inner: n("result/attempt", ["fail"]),
        wrap: n("result/ok", ["inner"]),
        outer: n("result/attempt", ["wrap"]),
      };
      const result = (await fold("outer", adj, attemptInterp)) as Result<Result<unknown>>;
      expect(result.err).toBeNull();
      expect(result.ok).toEqual({ ok: null, err: "inner" });
    });
  });

  describe("guard", () => {
    const guardInterp: Interpreter = {
      ...lit,
      "error/guard": async function* (e) {
        const cond = (yield 0) as boolean;
        if (!cond) throw new Error(e.out as string);
        return true;
      },
    };

    test("guard with true condition passes", async () => {
      const adj: Adj = {
        cond: n("bool/literal", [], true),
        root: n("error/guard", ["cond"], "nope"),
      };
      expect(await fold("root", adj, guardInterp)).toBe(true);
    });

    test("guard with false condition throws", async () => {
      const adj: Adj = {
        cond: n("bool/literal", [], false),
        root: n("error/guard", ["cond"], "precondition failed"),
      };
      await expect(fold("root", adj, guardInterp)).rejects.toThrow("precondition failed");
    });

    test("guard failure rejects fold (throw-based)", async () => {
      const adj: Adj = {
        cond: n("bool/literal", [], false),
        guard: n("error/guard", ["cond"], "guard failed"),
      };
      await expect(fold("guard", adj, guardInterp)).rejects.toThrow("guard failed");
    });
  });

  describe("settle (value-level)", () => {
    const settleInterp: Interpreter = {
      ...lit,
      "error/fail": async function* (e) {
        return err(e.out as string);
      },
      "result/ok": async function* () {
        return ok(yield 0);
      },
      "result/settle": async function* (entry) {
        const fulfilled: unknown[] = [],
          rejected: unknown[] = [];
        for (let i = 0; i < entry.children.length; i++) {
          const r = (yield i) as Result<unknown>;
          if (r.err !== null) rejected.push(r.err);
          else fulfilled.push(r.ok);
        }
        return { fulfilled, rejected };
      },
    };

    test("all succeed: fulfilled has all, rejected empty", async () => {
      const adj: Adj = {
        a: n("num/literal", [], 1),
        b: n("num/literal", [], 2),
        c: n("num/literal", [], 3),
        ra: n("result/ok", ["a"]),
        rb: n("result/ok", ["b"]),
        rc: n("result/ok", ["c"]),
        root: n("result/settle", ["ra", "rb", "rc"]),
      };
      expect(await fold("root", adj, settleInterp)).toEqual({
        fulfilled: [1, 2, 3],
        rejected: [],
      });
    });

    test("mixed: some succeed, some fail", async () => {
      const adj: Adj = {
        a: n("num/literal", [], 1),
        ra: n("result/ok", ["a"]),
        fb: n("error/fail", [], "b failed"),
        c: n("num/literal", [], 3),
        rc: n("result/ok", ["c"]),
        root: n("result/settle", ["ra", "fb", "rc"]),
      };
      expect(await fold("root", adj, settleInterp)).toEqual({
        fulfilled: [1, 3],
        rejected: ["b failed"],
      });
    });

    test("all fail: fulfilled empty, rejected has all", async () => {
      const adj: Adj = {
        fa: n("error/fail", [], "a failed"),
        fb: n("error/fail", [], "b failed"),
        fc: n("error/fail", [], "c failed"),
        root: n("result/settle", ["fa", "fb", "fc"]),
      };
      expect(await fold("root", adj, settleInterp)).toEqual({
        fulfilled: [],
        rejected: ["a failed", "b failed", "c failed"],
      });
    });
  });

  describe("fold infrastructure errors", () => {
    test("missing node throws descriptive error", async () => {
      await expect(fold("missing", {}, lit)).rejects.toThrow("missing node");
    });

    test("missing handler throws descriptive error", async () => {
      await expect(fold("a", { a: n("unknown/kind", [], 42) }, lit)).rejects.toThrow("no handler");
    });

    test("out-of-bounds child index throws", async () => {
      const interp: Interpreter = {
        "bad/ref": async function* () {
          yield 0;
        },
      };
      await expect(fold("a", { a: n("bad/ref", []) }, interp)).rejects.toThrow("no child");
    });

    test("async handler rejection propagates", async () => {
      const interp: Interpreter = {
        "async/fail": async function* () {
          await Promise.reject(new Error("async boom"));
        },
      };
      await expect(fold("a", { a: n("async/fail", []) }, interp)).rejects.toThrow("async boom");
    });
  });
});
