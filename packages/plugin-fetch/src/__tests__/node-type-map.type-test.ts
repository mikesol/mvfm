import type { TypedNode } from "@mvfm/core";
import { typedInterpreter } from "@mvfm/core";
import type { FetchHeadersNode, FetchRequestNode } from "../whatwg/interpreter";

const _fetchPositive = typedInterpreter<"fetch/request" | "fetch/headers">()({
  // biome-ignore lint/correctness/useYield: compile-time signature test
  "fetch/request": async function* (_node: FetchRequestNode) {
    return new Response();
  },
  // biome-ignore lint/correctness/useYield: compile-time signature test
  "fetch/headers": async function* (_node: FetchHeadersNode) {
    return {};
  },
});

const _fetchBadAny = typedInterpreter<"fetch/request">()({
  // @ts-expect-error registered kind cannot use any node parameter
  // biome-ignore lint/correctness/useYield: compile-time signature test
  "fetch/request": async function* (_node: any) {
    return new Response();
  },
});

interface WrongFetchNode extends TypedNode<number> {
  kind: "fetch/request";
}

const _fetchBadNode = typedInterpreter<"fetch/request">()({
  // @ts-expect-error wrong node shape for fetch/request
  // biome-ignore lint/correctness/useYield: compile-time signature test
  "fetch/request": async function* (_node: WrongFetchNode) {
    return 1;
  },
});
