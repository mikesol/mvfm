import type { Interpreter, TypedNode } from "../../fold";
import { defineInterpreter, eval_, foldAST, recurseScoped } from "../../fold";
import { injectLambdaParam } from "../../utils";

// ---- Typed node interfaces ----------------------------------

interface FiberParam {
  __id: number;
  name: string;
}

interface FiberParMap extends TypedNode<unknown[]> {
  kind: "fiber/par_map";
  collection: TypedNode<unknown[]>;
  concurrency: number;
  param: FiberParam;
  body: TypedNode;
}

interface FiberRace extends TypedNode<unknown> {
  kind: "fiber/race";
  branches: TypedNode[];
}

interface FiberTimeout extends TypedNode<unknown> {
  kind: "fiber/timeout";
  expr: TypedNode;
  ms: TypedNode<number>;
  fallback: TypedNode;
}

interface FiberRetry extends TypedNode<unknown> {
  kind: "fiber/retry";
  expr: TypedNode;
  attempts: number;
  delay: number;
}

declare module "@mvfm/core" {
  interface NodeTypeMap {
    "fiber/par_map": FiberParMap;
    "fiber/race": FiberRace;
    "fiber/timeout": FiberTimeout;
    "fiber/retry": FiberRetry;
  }
}

type FiberKinds = "fiber/par_map" | "fiber/race" | "fiber/timeout" | "fiber/retry";

// ---- Sequential interpreter (default) -----------------------

/** Sequential interpreter handlers for `fiber/` node kinds. */
export const fiberInterpreter = defineInterpreter<FiberKinds>()({
  "fiber/par_map": async function* (node: FiberParMap) {
    const collection = yield* eval_(node.collection);
    const results: unknown[] = [];
    for (let i = 0; i < collection.length; i += node.concurrency) {
      const batch = collection.slice(i, i + node.concurrency);
      for (const item of batch) {
        results.push(yield recurseScoped(node.body, [{ paramId: node.param.__id, value: item }]));
      }
    }
    return results;
  },

  "fiber/race": async function* (node: FiberRace) {
    if (node.branches.length === 0) throw new Error("fiber/race: no branches");
    return yield* eval_(node.branches[0]);
  },

  "fiber/timeout": async function* (node: FiberTimeout) {
    return yield* eval_(node.expr);
  },

  "fiber/retry": async function* (node: FiberRetry) {
    let lastError: unknown;
    for (let i = 0; i < node.attempts; i++) {
      try {
        const exprClone = structuredClone(node.expr);
        return yield* eval_(exprClone);
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError;
  },
});

// ---- Parallel interpreter factory ---------------------------

/**
 * Create fiber handlers that use true parallel execution.
 * Requires the full interpreter map for spawning parallel foldAST calls.
 *
 * Usage:
 * ```ts
 * const interp: Interpreter = { ...coreInterpreter, ...numInterpreter };
 * Object.assign(interp, createParallelFiberInterpreter(interp));
 * ```
 */
export function createParallelFiberInterpreter(interpreter: Interpreter): Interpreter {
  return defineInterpreter<FiberKinds>()({
    "fiber/par_map": async function* (node: FiberParMap) {
      const collection = yield* eval_(node.collection);
      const results: unknown[] = [];
      for (let i = 0; i < collection.length; i += node.concurrency) {
        const batch = collection.slice(i, i + node.concurrency);
        const batchResults = await Promise.all(
          batch.map((item) => {
            const bodyClone = structuredClone(node.body);
            injectLambdaParam(bodyClone, node.param.name, item);
            return foldAST(interpreter, bodyClone);
          }),
        );
        results.push(...batchResults);
      }
      return results;
    },

    "fiber/race": async function* (node: FiberRace) {
      if (node.branches.length === 0) {
        throw new Error("fiber/race: no branches");
      }
      return await Promise.race(node.branches.map((b) => foldAST(interpreter, b)));
    },

    "fiber/timeout": async function* (node: FiberTimeout) {
      const ms = yield* eval_(node.ms);
      const expr = foldAST(interpreter, node.expr);
      let timerId: ReturnType<typeof setTimeout>;
      const timer = new Promise<unknown>((resolve) => {
        timerId = setTimeout(async () => {
          resolve(await foldAST(interpreter, node.fallback));
        }, ms);
      });
      return await Promise.race([expr, timer]).finally(() => clearTimeout(timerId!));
    },

    "fiber/retry": async function* (node: FiberRetry) {
      let lastError: unknown;
      for (let i = 0; i < node.attempts; i++) {
        try {
          const exprClone = structuredClone(node.expr);
          return await foldAST(interpreter, exprClone);
        } catch (err) {
          lastError = err;
          if (i < node.attempts - 1 && node.delay > 0) {
            await new Promise((r) => setTimeout(r, node.delay));
          }
        }
      }
      throw lastError;
    },
  });
}
