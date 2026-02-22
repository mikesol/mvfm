/**
 * Front-door API — mvfm, fold, defaults, injectInput, prelude.
 *
 * Thin wrapper over the internal engine (elaborate, fold, plugin).
 * Provides the ergonomic builder pattern used by consumers.
 */

import type { CExpr, NExpr, RuntimeEntry } from "./expr";
import { isCExpr, makeCExpr, makeNExpr } from "./expr";
import { createApp } from "./elaborate";
import { fold as internalFold, defaults as internalDefaults } from "./fold";
import type { Interpreter, Plugin } from "./plugin";
import { mvfmU } from "./plugin";
import { numPlugin, boolPlugin, strPlugin, ordPlugin } from "./std-plugins";
import { corePlugin } from "./core-plugin";

export { coreInterpreter, corePlugin } from "./core-plugin";

// ─── Cell counter for unique IDs ────────────────────────────────────

let _cellCounter = 0;

// ─── prelude ────────────────────────────────────────────────────────

/** Standard prelude plugins: num, str, bool, ord. */
export const prelude: readonly Plugin[] = [numPlugin, strPlugin, boolPlugin, ordPlugin];

// ─── Program type ───────────────────────────────────────────────────

/** A compiled program with NExpr, plugin list, and optional input schema. */
export interface Program {
  readonly __nexpr: NExpr<any, any, any, any>;
  readonly __plugins: readonly Plugin[];
  readonly __inputSchema?: Record<string, string>;
}

// ─── Helper: deep auto-lift ─────────────────────────────────────────

function deepAutoLift(value: unknown): unknown {
  if (isCExpr(value)) return value;
  if (Array.isArray(value)) {
    return makeCExpr("core/tuple", [value.map(deepAutoLift)]);
  }
  if (typeof value === "object" && value !== null) {
    const lifted: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      lifted[k] = deepAutoLift(v);
    }
    return makeCExpr("core/record", [lifted]);
  }
  return value; // primitive — elaborate will auto-lift
}

// ─── Recording stack for imperative block capture ───────────────────

type RecordingStack = unknown[][];

function startRecording(stack: RecordingStack): void {
  stack.push([]);
}

function stopRecording(stack: RecordingStack): unknown[] {
  return stack.pop() ?? [];
}

/** Check if a CExpr appears as a (transitive) argument to another CExpr. */
function isConsumedBy(needle: unknown, haystack: unknown, depth = 0): boolean {
  if (depth > 20) return false;
  if (!isCExpr(haystack)) return false;
  const args = (haystack as any).__args as unknown[];
  for (const arg of args) {
    if (arg === needle) return true;
    if (isCExpr(arg) && isConsumedBy(needle, arg, depth + 1)) return true;
    // Check arrays (e.g., core/begin args, core/tuple data)
    if (Array.isArray(arg)) {
      for (const item of arg) {
        if (item === needle) return true;
        if (isCExpr(item) && isConsumedBy(needle, item, depth + 1)) return true;
      }
    }
    // Check plain objects (e.g., core/record data)
    if (typeof arg === "object" && arg !== null && !isCExpr(arg) && !Array.isArray(arg)) {
      for (const v of Object.values(arg)) {
        if (v === needle) return true;
        if (isCExpr(v) && isConsumedBy(needle, v, depth + 1)) return true;
      }
    }
  }
  return false;
}

/** Run a callback inside a recording context, return result or collected exprs. */
function runBlock(
  stack: RecordingStack,
  fn: (...args: unknown[]) => unknown,
  args: unknown[],
): unknown {
  startRecording(stack);
  const result = fn(...args);
  const recorded = stopRecording(stack);

  // Collect all expressions: recorded + result (if CExpr)
  const all = [...recorded];
  if (result !== undefined && isCExpr(result) && !all.includes(result)) {
    all.push(result);
  }

  // Filter out expressions that are consumed as arguments to other expressions
  const roots = all.filter((expr) => {
    for (const other of all) {
      if (other !== expr && isConsumedBy(expr, other)) return false;
    }
    return true;
  });

  if (roots.length === 0) return makeCExpr("core/begin", []);
  if (roots.length === 1) return roots[0];
  return makeCExpr("core/begin", roots);
}

// ─── mvfm ───────────────────────────────────────────────────────────

/** Create an app builder from plugins. Returns a function that takes a schema and builder. */
export function mvfm(...pluginInputs: (Plugin | readonly Plugin[])[]) {
  const plugins: Plugin[] = [corePlugin];
  for (const p of pluginInputs) {
    if (Array.isArray(p)) plugins.push(...(p as Plugin[]));
    else plugins.push(p as Plugin);
  }

  function define(schemaOrFn: any, maybeFn?: any): Program {
    const schema = typeof schemaOrFn === "function" ? undefined : schemaOrFn;
    const fn = typeof schemaOrFn === "function" ? schemaOrFn : maybeFn;

    const effects: unknown[] = [];
    const recording: RecordingStack = [];
    const pluginDollar = mvfmU(...plugins);

    const $ = {
      ...pluginDollar,
      input: makeCExpr("core/input", []),
      begin: (...exprs: unknown[]) => makeCExpr("core/begin", exprs),
      // Override show to be unary (auto-generated trait ctors are binary)
      show: (a: unknown) => makeCExpr("show", [a, a]),
      cond: (pred: unknown) => {
        const mkCond = (p: unknown, t: unknown, e: unknown) => {
          const c = makeCExpr("core/cond", [p, t, e]);
          // Only record in block context (inside each/while), not at top level
          if (recording.length > 0) {
            recording[recording.length - 1].push(c);
          }
          return c;
        };
        return {
          t: (then: unknown) => ({
            f: (els: unknown) => mkCond(pred, then, els),
          }),
          f: (els: unknown) => ({
            t: (then: unknown) => mkCond(pred, then, els),
          }),
        };
      },
    } as Record<string, any>;

    // Wrap st.let to auto-lift initial, push let-init to effects, and record set/push
    if ($.let) {
      $.let = (initial: unknown) => {
        const lifted = deepAutoLift(initial);
        // Create unique cell ID
        const cellId = `__cell_${_cellCounter++}`;
        const letExpr = makeCExpr("st/let", [lifted, cellId]);
        effects.push(letExpr); // ensure let-init runs before the result

        return {
          get: () => makeCExpr("st/get", [cellId]),
          set: (val: unknown) => {
            const expr = makeCExpr("st/set", [cellId, val]);
            if (recording.length > 0) {
              recording[recording.length - 1].push(expr);
            } else {
              effects.push(expr);
            }
            return expr;
          },
          push: (val: unknown) => {
            const expr = makeCExpr("st/push", [cellId, val]);
            if (recording.length > 0) {
              recording[recording.length - 1].push(expr);
            } else {
              effects.push(expr);
            }
            return expr;
          },
        };
      };
    }

    // each: unroll + imperative effect
    $.each = (items: unknown[], cb: (item: unknown) => unknown) => {
      const results = items.map((item: unknown) => runBlock(recording, cb, [item]));
      const expr = makeCExpr("core/begin", results);
      effects.push(expr);
      return expr;
    };

    // while: imperative effect
    $.while = (cond: unknown) => ({
      body: (bodyFn: () => unknown) => {
        const body = runBlock(recording, bodyFn, []);
        const whileExpr = makeCExpr("control/while", [cond, body]);
        effects.push(whileExpr);
        return whileExpr;
      },
    });

    let result = fn($);
    result = deepAutoLift(result);

    // Wrap result with collected imperative effects
    if (effects.length > 0) {
      result = makeCExpr("core/begin", [...effects, result]);
    }

    const nexpr = createApp(...plugins)(result as CExpr<any>);
    return { __nexpr: nexpr, __plugins: plugins, __inputSchema: schema };
  }

  define.plugins = plugins;
  return define;
}

// ─── injectInput ────────────────────────────────────────────────────

/** Inject input data into a compiled program, replacing core/input node outputs. */
export function injectInput(
  prog: Program, data: Record<string, unknown>,
): Program {
  const oldAdj = prog.__nexpr.__adj;
  const newAdj: Record<string, RuntimeEntry> = {};
  for (const [id, entry] of Object.entries(oldAdj)) {
    if (entry.kind === "core/input") {
      newAdj[id] = { ...entry, out: data };
    } else {
      newAdj[id] = entry;
    }
  }
  return {
    ...prog,
    __nexpr: makeNExpr(prog.__nexpr.__id, newAdj, prog.__nexpr.__counter),
  };
}

// ─── Public defaults ────────────────────────────────────────────────

/** Build a merged interpreter from plugins or an app object, with optional overrides. */
export function defaults(
  appOrPlugins: any, overrides?: Record<string, Interpreter>,
): Interpreter {
  if (Array.isArray(appOrPlugins)) {
    return internalDefaults(appOrPlugins, overrides);
  }
  const plugins = appOrPlugins.plugins ?? appOrPlugins.__plugins ?? [];
  return internalDefaults(plugins as Plugin[], overrides);
}

// ─── Public fold ────────────────────────────────────────────────────

/** Evaluate a program/NExpr. Supports fold(interp, prog) and fold(nexpr, interp). */
export async function fold(
  first: any, second: any, third?: any, fourth?: any,
): Promise<unknown> {
  if (typeof first === "string") {
    return internalFold(first, second, third, fourth);
  }
  if (first && typeof first === "object" && "__id" in first) {
    return internalFold(first, second, third);
  }
  return internalFold(second.__nexpr, first);
}
