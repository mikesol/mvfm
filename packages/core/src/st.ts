/**
 * State plugin — mutable cells with let, get, set, push.
 *
 * Provides $.let(initial) → { get(), set(val), push(val) } for
 * imperative state management within the DSL.
 *
 * Cell identity uses unique IDs stored as string literal children.
 * This avoids the CExpr deduplication problem in elaborate.
 */

import { makeCExpr } from "./expr";
import type { Interpreter, Plugin } from "./plugin";
import type { KindSpec } from "./registry";

let cellCounter = 0;

/** State plugin: let/get/set/push for mutable cells. */
export const st: Plugin = {
  name: "st",
  ctors: {
    let: (initial: unknown) => {
      const cellId = `__cell_${cellCounter++}`;
      const _letExpr = makeCExpr("st/let", [initial, cellId]);
      return {
        get: () => makeCExpr("st/get", [cellId]),
        set: (val: unknown) => makeCExpr("st/set", [cellId, val]),
        push: (val: unknown) => makeCExpr("st/push", [cellId, val]),
      };
    },
  },
  kinds: {
    "st/let": {
      inputs: [undefined, ""] as [unknown, string],
      output: undefined as unknown,
    } as KindSpec<[unknown, string], unknown>,
    "st/get": { inputs: [""] as [string], output: undefined as unknown } as KindSpec<
      [string],
      unknown
    >,
    "st/set": {
      inputs: ["", undefined] as [string, unknown],
      output: undefined as unknown,
    } as KindSpec<[string, unknown], unknown>,
    "st/push": {
      inputs: ["", undefined] as [string, unknown],
      output: undefined as unknown,
    } as KindSpec<[string, unknown], unknown>,
  },
  traits: {},
  lifts: {},
  defaultInterpreter: (): Interpreter => {
    const cells = new Map<string, unknown>();
    return {
      "st/let": async function* () {
        const val = yield 0;
        const cellId = (yield 1) as string;
        cells.set(cellId, val);
        return val;
      },
      "st/get": async function* () {
        const cellId = (yield 0) as string;
        return cells.get(cellId);
      },
      "st/set": async function* () {
        const cellId = (yield 0) as string;
        const val = yield 1;
        cells.set(cellId, val);
        return val;
      },
      "st/push": async function* () {
        const cellId = (yield 0) as string;
        const val = yield 1;
        const arr = cells.get(cellId);
        if (Array.isArray(arr)) {
          arr.push(val);
          cells.set(cellId, arr);
        }
        return val;
      },
    };
  },
};
