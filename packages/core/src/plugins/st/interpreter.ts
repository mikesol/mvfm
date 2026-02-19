/**
 * DAG-model interpreter for st/* node kinds.
 *
 * Each call to createStDagInterpreter() returns a fresh interpreter
 * with its own mutable store (Map<string, unknown>).
 *
 * Child layout:
 * - st/let: child 0 = initial value, `out` holds the ref name
 * - st/get: no children, `out` holds the ref name (volatile — always re-evaluates)
 * - st/set: child 0 = new value, `out` holds the ref name
 * - st/push: child 0 = value to push, `out` holds the ref name
 */

import type { Interpreter } from "../../dag/fold";

/** Create a fresh st interpreter with its own mutable variable store. */
export function createStDagInterpreter(): Interpreter {
  const store = new Map<string, unknown>();

  return {
    "st/let": async function* (entry) {
      const ref = entry.out as string;
      const value = yield 0;
      store.set(ref, value);
      return undefined;
    },
    "st/get": async function* (entry) {
      const ref = entry.out as string;
      if (!store.has(ref)) {
        throw new Error(`st/get: unknown ref "${ref}"`);
      }
      return store.get(ref);
    },
    "st/set": async function* (entry) {
      const ref = entry.out as string;
      if (!store.has(ref)) {
        throw new Error(`st/set: unknown ref "${ref}"`);
      }
      const value = yield 0;
      store.set(ref, value);
      return undefined;
    },
    "st/push": async function* (entry) {
      const ref = entry.out as string;
      if (!store.has(ref)) {
        throw new Error(`st/push: unknown ref "${ref}"`);
      }
      const value = yield 0;
      const arr = store.get(ref);
      if (!Array.isArray(arr)) {
        throw new Error(`st/push: ref "${ref}" is not an array`);
      }
      arr.push(value);
      return undefined;
    },
  };
}
