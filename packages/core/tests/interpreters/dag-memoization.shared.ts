import type { Interpreter, TypedNode } from "../../src/fold";
import { eval_ } from "../../src/fold";

export function createTrackingInterpreter(): {
  interpreter: Interpreter;
  visitCount: Map<string, number>;
} {
  const visitCount = new Map<string, number>();
  return {
    visitCount,
    interpreter: {
      // biome-ignore lint/correctness/useYield: leaf handler
      "track/value": async function* (node: any) {
        const id = node.id as string;
        visitCount.set(id, (visitCount.get(id) ?? 0) + 1);
        return node.value;
      },
      "track/add": async function* (node: any) {
        const id = node.id as string;
        visitCount.set(id, (visitCount.get(id) ?? 0) + 1);
        const left = (yield* eval_(node.left)) as number;
        const right = (yield* eval_(node.right)) as number;
        return left + right;
      },
      "track/pair": async function* (node: any) {
        const id = node.id as string;
        visitCount.set(id, (visitCount.get(id) ?? 0) + 1);
        const a = yield* eval_(node.a);
        const b = yield* eval_(node.b);
        return [a, b];
      },
      "track/parallel": async function* (node: any) {
        const id = node.id as string;
        visitCount.set(id, (visitCount.get(id) ?? 0) + 1);
        const elements = node.elements as TypedNode[];
        const results: unknown[] = [];
        for (const e of elements) {
          results.push(yield* eval_(e));
        }
        return results;
      },
    },
  };
}
