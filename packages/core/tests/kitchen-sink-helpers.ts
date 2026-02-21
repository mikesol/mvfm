/**
 * Shared test infrastructure for kitchen-sink torture tests.
 * Provides custom plugins and a composite interpreter covering
 * ST, error, lambda, sleep, structural, and accessor node kinds.
 */
import type { Handler, Interpreter } from "../src/index";
import { defaults, ordPlugin, recurseScoped, stdPlugins } from "../src/index";

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
    ...defaults([...stdPlugins, ordPlugin]),

    "st/cell": async function* (e) {
      state[e.children[0] ?? "default"] = (e.out as number) ?? 0;
      return e.out as number;
    } as Handler,

    "st/get": async function* (e) {
      const ref = (e.out as string) ?? "default";
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
      throw new Error((e.out as string) ?? "fail");
    } as Handler,

    "core/lambda_param": async function* () {
      throw new Error("lambda_param: should be resolved from scope");
    } as Handler,
    "lambda/apply": async function* (e) {
      const argVal = yield 0;
      const bodyId = e.children[1];
      const paramId =
        Object.values((e as unknown as { out: Record<string, string> }).out ?? {})[0] ?? bodyId;
      return yield recurseScoped(bodyId, [{ paramId, value: argVal }]) as unknown as number;
    } as Handler,
    "sleep/delay": async function* () {
      const ms = yield 0;
      await new Promise((r) => setTimeout(r, ms as number));
      return ms;
    } as Handler,
    "geom/point": async function* (e) {
      // Opus structural: children[0] is { x: nodeId, y: nodeId }
      const map = e.children[0] as unknown as Record<string, string>;
      const x = yield map.x;
      const y = yield map.y;
      return { x, y };
    } as Handler,
    "core/access": async function* (e) {
      const parent = yield 0;
      const key = e.out as string | number;
      return (parent as Record<string, unknown>)[key];
    } as Handler,
  };
  return { interp, state };
}
