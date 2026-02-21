/**
 * Tests for RecurseScopedEffect and scoped lambda evaluation.
 *
 * Validates that:
 * - recurseScoped evaluates a child with temporary bindings
 * - core/lambda_param resolves from scope stack
 * - Nested scopes shadow correctly
 * - Scope restores after scoped evaluation
 */
import { describe, expect, it } from "vitest";
import { fold, type RuntimeEntry, recurseScoped, VOLATILE_KINDS } from "../src/index";

// ─── Helpers ──────────────────────────────────────────────────────
function makeAdj(entries: Record<string, RuntimeEntry>) {
  return entries;
}
function handler(fn: (e: RuntimeEntry) => AsyncGenerator<any, unknown, unknown>) {
  return fn;
}

// ─── Tests ────────────────────────────────────────────────────────
describe("fold scoped evaluation", () => {
  it("recurseScoped builds correct effect", () => {
    const effect = recurseScoped("bodyId", [{ paramId: "p", value: 42 }]);
    expect(effect).toEqual({
      type: "recurse_scoped",
      childId: "bodyId",
      bindings: [{ paramId: "p", value: 42 }],
    });
  });

  it("lambda_param resolves from scope", async () => {
    // Setup: "apply" node evaluates body with param bound
    // body references lambda_param which should resolve to bound value
    const adj = makeAdj({
      param: { kind: "core/lambda_param", children: [], out: undefined },
      body: { kind: "test/wrap", children: ["param"], out: undefined },
      root: { kind: "test/apply", children: ["body"], out: undefined },
    });
    const interp = {
      "core/lambda_param": handler(async function* () {
        throw new Error("should not be called — resolved from scope");
      }),
      "test/wrap": handler(async function* () {
        const val = yield 0;
        return `wrapped(${val})`;
      }),
      "test/apply": handler(async function* (_e) {
        // Evaluate body with param bound to 100
        const result = yield recurseScoped("body", [{ paramId: "param", value: 100 }]);
        return result;
      }),
    };
    const result = await fold("root", adj, interp);
    expect(result).toBe("wrapped(100)");
  });

  it("nested scopes: inner binding shadows outer", async () => {
    const adj = makeAdj({
      param: { kind: "core/lambda_param", children: [], out: undefined },
      readParam: { kind: "test/read", children: ["param"], out: undefined },
      inner: { kind: "test/scope", children: ["readParam"], out: undefined },
      outer: { kind: "test/scope", children: ["inner"], out: undefined },
    });
    const interp = {
      "core/lambda_param": handler(async function* () {
        throw new Error("should resolve from scope");
      }),
      "test/read": handler(async function* () {
        return yield 0;
      }),
      "test/scope": handler(async function* (e) {
        const childId = e.children[0];
        // Outer binds param=10, inner binds param=20
        const isOuter = e.kind === "test/scope" && childId === "inner";
        const val = isOuter ? 10 : 20;
        return yield recurseScoped(childId, [{ paramId: "param", value: val }]);
      }),
    };
    const result = await fold("outer", adj, interp);
    expect(result).toBe(20); // inner binding shadows outer
  });

  it("scope restores after scoped evaluation", async () => {
    // After scoped eval, subsequent yields should not see the scoped bindings
    const adj = makeAdj({
      param: { kind: "core/lambda_param", children: [], out: undefined },
      body: { kind: "test/read", children: ["param"], out: undefined },
      after: { kind: "num/literal", children: [], out: 999 },
      root: { kind: "test/scope-then-normal", children: ["body", "after"], out: undefined },
    });
    const interp = {
      "core/lambda_param": handler(async function* () {
        return "unbound"; // default when not in scope
      }),
      "test/read": handler(async function* () {
        return yield 0;
      }),
      "num/literal": handler(async function* (e) {
        return e.out;
      }),
      "test/scope-then-normal": handler(async function* (_e) {
        const scoped = yield recurseScoped("body", [{ paramId: "param", value: 42 }]);
        const normal = yield 1; // "after" node
        return [scoped, normal];
      }),
    };
    const result = await fold("root", adj, interp);
    expect(result).toEqual([42, 999]);
  });

  it("multiple bindings in single scope", async () => {
    const adj = makeAdj({
      px: { kind: "core/lambda_param", children: [], out: undefined },
      py: { kind: "core/lambda_param", children: [], out: undefined },
      body: { kind: "test/add-params", children: ["px", "py"], out: undefined },
      root: { kind: "test/apply2", children: ["body"], out: undefined },
    });
    const interp = {
      "core/lambda_param": handler(async function* () {
        throw new Error("should resolve from scope");
      }),
      "test/add-params": handler(async function* () {
        const x = yield 0;
        const y = yield 1;
        return (x as number) + (y as number);
      }),
      "test/apply2": handler(async function* () {
        return yield recurseScoped("body", [
          { paramId: "px", value: 3 },
          { paramId: "py", value: 7 },
        ]);
      }),
    };
    const result = await fold("root", adj, interp);
    expect(result).toBe(10);
  });

  it("lambda_param is volatile (not cached between scoped calls)", async () => {
    expect(VOLATILE_KINDS.has("core/lambda_param")).toBe(true);

    const adj = makeAdj({
      param: { kind: "core/lambda_param", children: [], out: undefined },
      body: { kind: "test/read", children: ["param"], out: undefined },
      root: { kind: "test/call-twice", children: ["body"], out: undefined },
    });
    const interp = {
      "core/lambda_param": handler(async function* () {
        throw new Error("should resolve from scope");
      }),
      "test/read": handler(async function* () {
        return yield 0;
      }),
      "test/call-twice": handler(async function* () {
        const r1 = yield recurseScoped("body", [{ paramId: "param", value: "first" }]);
        const r2 = yield recurseScoped("body", [{ paramId: "param", value: "second" }]);
        return [r1, r2];
      }),
    };
    const result = await fold("root", adj, interp);
    expect(result).toEqual(["first", "second"]);
  });

  it("scoped eval with error propagation", async () => {
    const adj = makeAdj({
      param: { kind: "core/lambda_param", children: [], out: undefined },
      bomb: { kind: "test/throw", children: [], out: undefined },
      body: { kind: "test/read", children: ["param", "bomb"], out: undefined },
      fallback: { kind: "num/literal", children: [], out: -1 },
      root: { kind: "test/safe-apply", children: ["body", "fallback"], out: undefined },
    });
    const interp = {
      "core/lambda_param": handler(async function* () {
        throw new Error("should resolve from scope");
      }),
      "test/throw": handler(async function* () {
        throw new Error("body failed");
      }),
      "num/literal": handler(async function* (e) {
        return e.out;
      }),
      "test/read": handler(async function* () {
        yield 0; // read param
        yield 1; // this throws
        return "unreachable";
      }),
      "test/safe-apply": handler(async function* () {
        try {
          return yield recurseScoped("body", [{ paramId: "param", value: 42 }]);
        } catch {
          return yield 1; // fallback
        }
      }),
    };
    const result = await fold("root", adj, interp);
    expect(result).toBe(-1);
  });
});
