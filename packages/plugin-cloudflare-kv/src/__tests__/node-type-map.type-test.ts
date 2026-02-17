import type { TypedNode } from "@mvfm/core";
import { typedInterpreter } from "@mvfm/core";
import type { CloudflareKvGetNode, CloudflareKvListNode } from "../4.20260213.0/interpreter";

const _kvPositive = typedInterpreter<"cloudflare-kv/get" | "cloudflare-kv/list">()({
  // biome-ignore lint/correctness/useYield: compile-time signature test
  "cloudflare-kv/get": async function* (_node: CloudflareKvGetNode) {
    return null;
  },
  // biome-ignore lint/correctness/useYield: compile-time signature test
  "cloudflare-kv/list": async function* (_node: CloudflareKvListNode) {
    return { keys: [], list_complete: true };
  },
});

const _kvBadAny = typedInterpreter<"cloudflare-kv/get">()({
  // @ts-expect-error registered kind cannot use any node parameter
  // biome-ignore lint/correctness/useYield: compile-time signature test
  "cloudflare-kv/get": async function* (_node: any) {
    return null;
  },
});

interface WrongKvNode extends TypedNode<number> {
  kind: "cloudflare-kv/list";
}

const _kvBadNode = typedInterpreter<"cloudflare-kv/list">()({
  // @ts-expect-error wrong node shape for cloudflare-kv/list
  // biome-ignore lint/correctness/useYield: compile-time signature test
  "cloudflare-kv/list": async function* (_node: WrongKvNode) {
    return 1;
  },
});
