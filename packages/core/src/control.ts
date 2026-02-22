/**
 * Control plugin — each (unrolled loop) and while (runtime loop).
 *
 * each() unrolls at CExpr build time into a begin sequence.
 * while() creates a control/while node evaluated by the fold engine.
 */

import { makeCExpr } from "./expr";
import type { Interpreter, Plugin } from "./plugin";
import type { KindSpec } from "./registry";

// ─── control plugin ─────────────────────────────────────────────────

/** Control plugin: each (unrolled) and while (runtime loop). */
export const control: Plugin = {
  name: "control",
  ctors: {
    each: (items: unknown[], fn: (item: unknown) => unknown) => {
      const results = items.map((item) => fn(item));
      return makeCExpr("core/begin", results);
    },
    while: (cond: unknown) => ({
      body: (fn: () => unknown) => {
        const body = fn();
        return makeCExpr("control/while", [cond, body]);
      },
    }),
  },
  kinds: {
    "control/while": {
      inputs: [false, undefined] as [boolean, unknown],
      output: undefined as unknown,
    } as KindSpec<[boolean, unknown], unknown>,
  },
  traits: {},
  lifts: {},
  defaultInterpreter: (): Interpreter => ({
    "control/while": async function* () {
      while (true) {
        const cond = yield 0;
        if (!cond) break;
        yield 1;
      }
      return undefined;
    },
  }),
};
