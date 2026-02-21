/**
 * Shared test infrastructure for kitchen-sink torture tests.
 * Provides custom plugins and a composite interpreter covering
 * ST, error, lambda, sleep, structural, and accessor node kinds.
 */

import type { Handler, Interpreter, ScopedEffect } from "../src/koan";
import { koan } from "../src/koan";

// ─── Custom plugins for ST + error + lambda + sleep ──────────────────

export const stPlugin = {
  name: "st",
  ctors: {},
  kinds: {
    "st/cell": { inputs: [], output: 0 as number },
    "st/get": { inputs: [], output: 0 as number },
    "st/set": { inputs: [0, 0], output: 0 as number },
  },
  traits: {},
  lifts: {},
  nodeKinds: ["st/cell", "st/get", "st/set"],
} as const;

export const errorPlugin = {
  name: "error",
  ctors: {},
  kinds: {
    "error/try": { inputs: [0, 0], output: 0 as number },
    "error/fail": { inputs: [], output: 0 as number },
  },
  traits: {},
  lifts: {},
  nodeKinds: ["error/try", "error/fail"],
} as const;

export const lambdaPlugin = {
  name: "lambda",
  ctors: {},
  kinds: {
    "core/lambda_param": { inputs: [], output: 0 as number },
    "lambda/apply": { inputs: [0, 0], output: 0 as number },
  },
  traits: {},
  lifts: {},
  nodeKinds: ["core/lambda_param", "lambda/apply"],
} as const;

export const sleepPlugin = {
  name: "sleep",
  ctors: {},
  kinds: {
    "sleep/delay": { inputs: [0], output: 0 as number },
  },
  traits: {},
  lifts: {},
  nodeKinds: ["sleep/delay"],
} as const;

// ─── Composite interpreter ───────────────────────────────────────────

export function createTestInterp(): { interp: Interpreter; state: Record<string, number> } {
  const state: Record<string, number> = {};
  const interp: Interpreter = {
    ...koan.defaults([...koan.stdPlugins, koan.ordPlugin]),
    "st/cell": async function* (e) {
      state[e.children[0] ?? "default"] = (e.out as number) ?? 0;
      yield* [];
      return e.out as number;
    } as Handler,
    "st/get": async function* (e) {
      const ref = (e.out as string) ?? "default";
      yield* [];
      return state[ref] ?? 0;
    } as Handler,
    "st/set": async function* () {
      const ref = yield 0;
      const val = yield 1;
      state[String(ref)] = val as number;
      return val;
    } as Handler,
    "error/try": async function* () {
      try {
        return yield 0;
      } catch {
        return yield 1;
      }
    } as Handler,
    "error/fail": async function* (e) {
      yield* [];
      throw new Error((e.out as string) ?? "fail");
    } as Handler,
    "core/lambda_param": async function* () {
      yield* [];
      throw new Error("lambda_param: should be resolved from scope");
    } as Handler,
    "lambda/apply": async function* (e) {
      const argVal = yield 0;
      const bodyId = e.children[1];
      const paramId =
        Object.values((e as unknown as { out: Record<string, string> }).out ?? {})[0] ?? bodyId;
      const effect: ScopedEffect = {
        type: "recurse_scoped",
        child: bodyId,
        bindings: [{ paramId, value: argVal }],
      };
      return yield effect as unknown as number;
    } as Handler,
    "sleep/delay": async function* () {
      const ms = yield 0;
      await new Promise((r) => setTimeout(r, ms as number));
      return ms;
    } as Handler,
    "core/record": async function* (e) {
      const fields = e.out as Record<string, string>;
      const result: Record<string, unknown> = {};
      for (const [key, childId] of Object.entries(fields)) {
        result[key] = yield childId;
      }
      return result;
    } as Handler,
    "core/tuple": async function* (e) {
      const childIds = e.out as string[];
      const result: unknown[] = [];
      for (const childId of childIds) {
        result.push(yield childId);
      }
      return result;
    } as Handler,
    "core/access": async function* (e) {
      const parent = yield 0;
      const key = e.out as string | number;
      return (parent as Record<string, unknown>)[key];
    } as Handler,
    "geom/point": async function* () {
      // codex wraps structural input in core/record, so point has 1 child
      return yield 0;
    } as Handler,
  };
  return { interp, state };
}
