/**
 * Fiber plugin — concurrency primitives: par, race, timeout, retry.
 *
 * Uses a closure-scoped item stack so that fiber/par_item nodes
 * can access the current iteration value during par_map evaluation.
 */

import { isCExpr, makeCExpr } from "./expr";
import type { Interpreter, Plugin } from "./plugin";

// ─── fiber plugin ──────────────────────────────────────────────────

/** Fiber plugin: concurrency combinators for the DSL. */
export const fiber: Plugin = {
  name: "fiber",
  ctors: {
    par: (...args: unknown[]) => {
      // Map form: par(collection, opts, fn)
      if (
        args.length === 3 &&
        typeof args[1] === "object" &&
        args[1] !== null &&
        !isCExpr(args[1]) &&
        "concurrency" in (args[1] as Record<string, unknown>) &&
        typeof args[2] === "function"
      ) {
        const [collection, opts, fn] = args as [
          unknown,
          { concurrency: number },
          (item: unknown) => unknown,
        ];
        const paramExpr = makeCExpr("fiber/par_item", []);
        const body = fn(paramExpr);
        return makeCExpr("fiber/par_map", [collection, opts.concurrency, body]);
      }
      // Tuple form: par(a, b, c) — just wrap in tuple
      return makeCExpr("core/tuple", [args]);
    },
    race: (...exprs: unknown[]) => makeCExpr("fiber/race", exprs),
    timeout: (expr: unknown, ms: unknown, fallback: unknown) =>
      makeCExpr("fiber/timeout", [expr, ms, fallback]),
    retry: (expr: unknown, opts: { attempts: number; delay?: number }) =>
      makeCExpr("fiber/retry", [expr, opts.attempts, opts.delay ?? 0]),
  },
  kinds: {},
  traits: {},
  lifts: {},
  nodeKinds: ["fiber/par_map", "fiber/par_item", "fiber/race", "fiber/timeout", "fiber/retry"],
  defaultInterpreter: (): Interpreter => {
    const itemStack: unknown[] = [];
    return {
      "fiber/par_item": async function* () {
        return itemStack[itemStack.length - 1];
      },
      "fiber/par_map": async function* () {
        const collection = (yield 0) as unknown[];
        const concurrency = (yield 1) as number;
        const results: unknown[] = [];
        for (let i = 0; i < collection.length; i += concurrency) {
          const batch = collection.slice(i, i + concurrency);
          for (const item of batch) {
            itemStack.push(item);
            try {
              results.push(yield 2);
            } finally {
              itemStack.pop();
            }
          }
        }
        return results;
      },
      "fiber/race": async function* (e) {
        if (e.children.length === 0) throw new Error("fiber/race: no branches");
        return yield 0;
      },
      "fiber/timeout": async function* () {
        // Sequential: just evaluate the expression (ignore ms and fallback)
        return yield 0;
      },
      "fiber/retry": async function* () {
        const attempts = (yield 1) as number;
        const delay = (yield 2) as number;
        let lastError: unknown;
        for (let i = 0; i < attempts; i++) {
          try {
            return yield 0;
          } catch (err) {
            lastError = err;
            if (delay > 0 && i < attempts - 1) {
              await new Promise((r) => setTimeout(r, delay));
            }
          }
        }
        throw lastError;
      },
    };
  },
};
