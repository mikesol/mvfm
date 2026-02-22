/**
 * Core plugin — interpreter and plugin definition for core node kinds.
 *
 * Handles: literal, input, access, begin, cond, record, tuple.
 * The core plugin is always included automatically by mvfm().
 */

import type { Interpreter, Plugin } from "./plugin";
import type { KindSpec } from "./registry";

// ─── coreInterpreter ────────────────────────────────────────────────

/** Interpreter for core node kinds: literal, input, access, begin, cond, record, tuple. */
export const coreInterpreter: Interpreter = {
  "core/literal": async function* (e) {
    return e.out;
  },
  "core/input": async function* (e) {
    return e.out;
  },
  "core/access": async function* (e) {
    const parent = yield 0;
    return (parent as Record<string, unknown>)[e.out as string | number];
  },
  "core/begin": async function* (e) {
    let result: unknown;
    for (let i = 0; i < e.children.length; i++) result = yield i;
    return result;
  },
  "core/cond": async function* () {
    const pred = yield 0;
    return pred ? yield 1 : yield 2;
  },
  "core/record": async function* (e) {
    const map = e.children[0] as unknown as Record<string, string>;
    const result: Record<string, unknown> = {};
    for (const [key, childId] of Object.entries(map)) {
      result[key] = yield childId;
    }
    return result;
  },
  "core/tuple": async function* (e) {
    const map = e.children[0] as unknown as unknown[];
    const results: unknown[] = [];
    for (const childId of map) {
      results.push(yield childId as string);
    }
    return results;
  },
};

// ─── Core plugin (for elaborate registration) ──────────────────────

/** Core plugin definition registering core node kinds and shapes. */
export const corePlugin: Plugin = {
  name: "core",
  ctors: {},
  kinds: {
    "core/literal": { inputs: [] as [], output: undefined as unknown } as KindSpec<[], unknown>,
    "core/input": { inputs: [] as [], output: undefined as unknown } as KindSpec<[], unknown>,
    "core/access": { inputs: [undefined] as [unknown], output: undefined as unknown } as KindSpec<
      [unknown],
      unknown
    >,
    "core/begin": { inputs: [] as unknown[], output: undefined as unknown } as KindSpec<
      unknown[],
      unknown
    >,
    "core/cond": {
      inputs: [false, undefined, undefined] as [boolean, unknown, unknown],
      output: undefined as unknown,
    } as KindSpec<[boolean, unknown, unknown], unknown>,
    "core/record": { inputs: [] as unknown[], output: undefined as unknown } as KindSpec<
      unknown[],
      unknown
    >,
    "core/tuple": { inputs: [] as unknown[], output: [] as unknown[] } as KindSpec<
      unknown[],
      unknown[]
    >,
  },
  traits: {},
  lifts: {},
  shapes: { "core/record": "*", "core/tuple": "*" },
  defaultInterpreter: () => coreInterpreter,
};
