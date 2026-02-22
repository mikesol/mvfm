/**
 * Kitchen-sink torture test (part 2) — exercises fold extensions
 * (scoped lambdas, volatile/taint, error propagation, async delays)
 * and negative tests designed to catch subtle cross-feature breakage.
 */
import { describe, expect, it } from "vitest";
import { add, app, commit, dirty, eq, fold, recurseScoped, removeEntry } from "../src/index";
import { createTestInterp } from "./kitchen-sink-helpers";

// ═════════════════════════════════════════════════════════════════════
// Fold extensions — scoped lambda + volatile + error + async
// ═════════════════════════════════════════════════════════════════════

describe("kitchen sink: fold extensions + negative", () => {
  it("scoped lambda: x => add(x, x) applied with x=7", async () => {
    const adj: Record<string, { kind: string; children: string[]; out: unknown }> = {
      param: { kind: "core/lambda_param", children: [], out: undefined },
      body: { kind: "num/add", children: ["param", "param"], out: undefined },
      arg: { kind: "num/literal", children: [], out: 7 },
      root: { kind: "lambda/apply", children: ["arg", "body"], out: { p: "param" } },
    };
    const { interp } = createTestInterp();
    const result = await fold("root", adj, interp);
    expect(result).toBe(14); // 7 + 7
  });

  it("scoped lambda called twice — no stale cache", async () => {
    const adj: Record<string, { kind: string; children: string[]; out: unknown }> = {
      param: { kind: "core/lambda_param", children: [], out: undefined },
      body: { kind: "num/add", children: ["param", "param"], out: undefined },
      root: { kind: "test/apply-twice", children: ["body"], out: { p: "param" } },
    };
    const { interp } = createTestInterp();
    interp["test/apply-twice"] = async function* (e) {
      const bodyId = e.children[0];
      const paramId = "param";
      const r1: unknown = yield recurseScoped(bodyId, [{ paramId, value: 3 }]) as unknown as number;
      const r2: unknown = yield recurseScoped(bodyId, [{ paramId, value: 5 }]) as unknown as number;
      return [r1 as number, r2 as number];
    };
    const result = await fold("root", adj, interp);
    expect(result).toEqual([6, 10]); // 3+3, 5+5
  });

  it("error/try catches error/fail and falls back", async () => {
    const adj: Record<string, { kind: string; children: string[]; out: unknown }> = {
      bomb: { kind: "error/fail", children: [], out: "kaboom" },
      safe: { kind: "num/literal", children: [], out: 42 },
      root: { kind: "error/try", children: ["bomb", "safe"], out: undefined },
    };
    const { interp } = createTestInterp();
    const result = await fold("root", adj, interp);
    expect(result).toBe(42);
  });

  it("error inside scoped lambda caught by outer try", async () => {
    const adj: Record<string, { kind: string; children: string[]; out: unknown }> = {
      param: { kind: "core/lambda_param", children: [], out: undefined },
      bomb: { kind: "error/fail", children: [], out: "scoped boom" },
      body: { kind: "num/add", children: ["param", "bomb"], out: undefined },
      arg: { kind: "num/literal", children: [], out: 1 },
      apply: {
        kind: "lambda/apply",
        children: ["arg", "body"],
        out: { p: "param" },
      },
      fallback: { kind: "num/literal", children: [], out: -1 },
      root: { kind: "error/try", children: ["apply", "fallback"], out: undefined },
    };
    const { interp } = createTestInterp();
    const result = await fold("root", adj, interp);
    expect(result).toBe(-1); // error caught, fallback used
  });

  it("concurrent sleep delays resolve correctly (fiber-like)", async () => {
    const adj: Record<string, { kind: string; children: string[]; out: unknown }> = {
      ms1: { kind: "num/literal", children: [], out: 5 },
      ms2: { kind: "num/literal", children: [], out: 3 },
      d1: { kind: "sleep/delay", children: ["ms1"], out: undefined },
      d2: { kind: "sleep/delay", children: ["ms2"], out: undefined },
      root: { kind: "num/add", children: ["d1", "d2"], out: undefined },
    };
    const { interp } = createTestInterp();
    const result = await fold("root", adj, interp);
    expect(result).toBe(8); // 5 + 3
  });

  // ═══════════════════════════════════════════════════════════════════
  // Negative tests — subtle breakage
  // ═══════════════════════════════════════════════════════════════════

  it("NEGATIVE: missing handler for node kind", async () => {
    const adj: Record<string, { kind: string; children: string[]; out: unknown }> = {
      root: { kind: "nonexistent/kind", children: [], out: undefined },
    };
    const { interp } = createTestInterp();
    await expect(fold("root", adj, interp)).rejects.toThrow("no handler");
  });

  it("NEGATIVE: missing node in adjacency", async () => {
    const adj: Record<string, { kind: string; children: string[]; out: unknown }> = {
      root: { kind: "num/add", children: ["a", "b"], out: undefined },
      a: { kind: "num/literal", children: [], out: 1 },
      // b intentionally missing
    };
    const { interp } = createTestInterp();
    await expect(fold("root", adj, interp)).rejects.toThrow();
  });

  it("NEGATIVE: commit rejects dangling child reference", () => {
    const prog = app(add(1, 2));
    const d = dirty(prog);
    const rootEntry = d.__adj[d.__id];
    const childToRemove = rootEntry.children[0];
    const mutated = removeEntry(d, childToRemove);
    expect(() => commit(mutated as any)).toThrow();
  });

  it("NEGATIVE: error/fail without try propagates to caller", async () => {
    const adj: Record<string, { kind: string; children: string[]; out: unknown }> = {
      bomb: { kind: "error/fail", children: [], out: "uncaught" },
      root: { kind: "num/add", children: ["bomb", "bomb"], out: undefined },
    };
    const { interp } = createTestInterp();
    await expect(fold("root", adj, interp)).rejects.toThrow("uncaught");
  });

  it("NEGATIVE: unbound lambda_param outside scope throws", async () => {
    const adj: Record<string, { kind: string; children: string[]; out: unknown }> = {
      param: { kind: "core/lambda_param", children: [], out: undefined },
      root: { kind: "num/add", children: ["param", "param"], out: undefined },
    };
    const { interp } = createTestInterp();
    await expect(fold("root", adj, interp)).rejects.toThrow();
  });

  it("NEGATIVE: trait type mismatch at elaboration", () => {
    expect(() => app(eq(1, "hello") as any)).toThrow();
  });
});
