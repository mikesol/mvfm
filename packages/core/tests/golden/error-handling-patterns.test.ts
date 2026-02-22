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

describe("error handling patterns", () => {
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
