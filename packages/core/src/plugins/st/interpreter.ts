import type { TypedNode } from "../../fold";
import { defineInterpreter, eval_ } from "../../fold";

interface StLetNode extends TypedNode<void> {
  kind: "st/let";
  ref: string;
  initial: TypedNode;
}

interface StGetNode extends TypedNode<unknown> {
  kind: "st/get";
  ref: string;
}

interface StSetNode extends TypedNode<void> {
  kind: "st/set";
  ref: string;
  value: TypedNode;
}

interface StPushNode extends TypedNode<void> {
  kind: "st/push";
  ref: string;
  value: TypedNode;
}

declare module "@mvfm/core" {
  interface NodeTypeMap {
    "st/let": StLetNode;
    "st/get": StGetNode;
    "st/set": StSetNode;
    "st/push": StPushNode;
  }
}

/** Create a fresh st interpreter with its own mutable variable store. */
export function createStInterpreter() {
  const store = new Map<string, unknown>();

  return defineInterpreter<"st/let" | "st/get" | "st/set" | "st/push">()({
    "st/let": async function* (node: StLetNode) {
      const value = yield* eval_(node.initial);
      store.set(node.ref, value);
      return undefined;
    },

    // biome-ignore lint/correctness/useYield: leaf handler reads from store directly
    "st/get": async function* (node: StGetNode) {
      if (!store.has(node.ref)) {
        throw new Error(`st/get: unknown ref "${node.ref}"`);
      }
      return store.get(node.ref);
    },

    "st/set": async function* (node: StSetNode) {
      if (!store.has(node.ref)) {
        throw new Error(`st/set: unknown ref "${node.ref}"`);
      }
      const value = yield* eval_(node.value);
      store.set(node.ref, value);
      return undefined;
    },

    "st/push": async function* (node: StPushNode) {
      if (!store.has(node.ref)) {
        throw new Error(`st/push: unknown ref "${node.ref}"`);
      }
      const value = yield* eval_(node.value);
      const arr = store.get(node.ref);
      if (!Array.isArray(arr)) {
        throw new Error(`st/push: ref "${node.ref}" is not an array`);
      }
      arr.push(value);
      return undefined;
    },
  });
}

/** Pre-created st interpreter instance for use as defaultInterpreter. */
export const stInterpreter = createStInterpreter();
