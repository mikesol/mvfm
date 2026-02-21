/**
 * Tests for error propagation through the fold trampoline.
 *
 * Validates that:
 * - Handler errors propagate up the stack
 * - Handlers can catch child errors via try/catch around yield
 * - Recovered errors produce valid return values
 * - Uncaught errors surface from fold()
 */
import { describe, expect, it } from "vitest";
import { fold, type RuntimeEntry } from "../src/index";

// ─── Helpers ──────────────────────────────────────────────────────
function makeAdj(entries: Record<string, RuntimeEntry>) {
  return entries;
}
function handler(fn: (e: RuntimeEntry) => AsyncGenerator<any, unknown, unknown>) {
  return fn;
}

// ─── Tests ────────────────────────────────────────────────────────
describe("fold error propagation", () => {
  it("child error propagates to fold caller when unhandled", async () => {
    const adj = makeAdj({
      bomb: { kind: "test/throw", children: [], out: undefined },
      root: { kind: "test/use", children: ["bomb"], out: undefined },
    });
    const interp = {
      "test/throw": handler(async function* () {
        throw new Error("boom");
      }),
      "test/use": handler(async function* () {
        return yield 0;
      }),
    };
    await expect(fold("root", adj, interp)).rejects.toThrow("boom");
  });

  it("handler catches child error via try/catch", async () => {
    const adj = makeAdj({
      bomb: { kind: "test/throw", children: [], out: undefined },
      fallback: { kind: "num/literal", children: [], out: 42 },
      root: { kind: "test/try", children: ["bomb", "fallback"], out: undefined },
    });
    const interp = {
      "test/throw": handler(async function* () {
        throw new Error("child error");
      }),
      "num/literal": handler(async function* (e) {
        return e.out;
      }),
      "test/try": handler(async function* () {
        try {
          return yield 0; // try child 0
        } catch {
          return yield 1; // fallback to child 1
        }
      }),
    };
    const result = await fold("root", adj, interp);
    expect(result).toBe(42);
  });

  it("error message is preserved through propagation", async () => {
    const adj = makeAdj({
      deep: { kind: "test/throw", children: [], out: undefined },
      mid: { kind: "test/use", children: ["deep"], out: undefined },
      top: { kind: "test/use", children: ["mid"], out: undefined },
    });
    const interp = {
      "test/throw": handler(async function* () {
        throw new Error("deep error");
      }),
      "test/use": handler(async function* () {
        return yield 0;
      }),
    };
    await expect(fold("top", adj, interp)).rejects.toThrow("deep error");
  });

  it("handler recovers from error and returns value", async () => {
    const adj = makeAdj({
      bomb: { kind: "test/throw", children: [], out: undefined },
      root: { kind: "test/recover", children: ["bomb"], out: undefined },
    });
    const interp = {
      "test/throw": handler(async function* () {
        throw new Error("fail");
      }),
      "test/recover": handler(async function* () {
        try {
          yield 0;
          return "unreachable";
        } catch (e: any) {
          return `recovered: ${e.message}`;
        }
      }),
    };
    const result = await fold("root", adj, interp);
    expect(result).toBe("recovered: fail");
  });

  it("error in root handler surfaces from fold", async () => {
    const adj = makeAdj({
      root: { kind: "test/throw", children: [], out: undefined },
    });
    const interp = {
      "test/throw": handler(async function* () {
        throw new Error("root error");
      }),
    };
    await expect(fold("root", adj, interp)).rejects.toThrow("root error");
  });

  it("try/catch does not interfere with normal flow", async () => {
    const adj = makeAdj({
      child: { kind: "num/literal", children: [], out: 10 },
      root: { kind: "test/try", children: ["child"], out: undefined },
    });
    const interp = {
      "num/literal": handler(async function* (e) {
        return e.out;
      }),
      "test/try": handler(async function* () {
        try {
          return yield 0;
        } catch {
          return "should not reach";
        }
      }),
    };
    const result = await fold("root", adj, interp);
    expect(result).toBe(10);
  });

  it("nested try/catch: inner catches, outer unaffected", async () => {
    const adj = makeAdj({
      bomb: { kind: "test/throw", children: [], out: undefined },
      fallback: { kind: "num/literal", children: [], out: 7 },
      inner: { kind: "test/try", children: ["bomb", "fallback"], out: undefined },
      outer: { kind: "test/use", children: ["inner"], out: undefined },
    });
    const interp = {
      "test/throw": handler(async function* () {
        throw new Error("inner error");
      }),
      "num/literal": handler(async function* (e) {
        return e.out;
      }),
      "test/try": handler(async function* () {
        try {
          return yield 0;
        } catch {
          return yield 1;
        }
      }),
      "test/use": handler(async function* () {
        return yield 0;
      }),
    };
    const result = await fold("outer", adj, interp);
    expect(result).toBe(7);
  });

  it("error after successful yields still propagates", async () => {
    const adj = makeAdj({
      ok: { kind: "num/literal", children: [], out: 1 },
      bomb: { kind: "test/throw", children: [], out: undefined },
      root: { kind: "test/seq", children: ["ok", "bomb"], out: undefined },
    });
    const interp = {
      "num/literal": handler(async function* (e) {
        return e.out;
      }),
      "test/throw": handler(async function* () {
        throw new Error("late boom");
      }),
      "test/seq": handler(async function* () {
        const a = yield 0;
        const b = yield 1;
        return [a, b];
      }),
    };
    await expect(fold("root", adj, interp)).rejects.toThrow("late boom");
  });
});
