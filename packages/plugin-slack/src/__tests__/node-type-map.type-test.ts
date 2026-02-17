import { typedInterpreter } from "@mvfm/core";

const _positive = typedInterpreter<"slack/chat_postMessage">()({
  // biome-ignore lint/correctness/useYield: type-level compile test
  "slack/chat_postMessage": async function* (node) {
    return node;
  },
});

const _negativeAny = typedInterpreter<"slack/chat_postMessage">()({
  // @ts-expect-error should reject node:any once kind is registered in NodeTypeMap
  // biome-ignore lint/correctness/useYield: type-level compile test
  "slack/chat_postMessage": async function* (node: any) {
    return node;
  },
});

void _positive;
void _negativeAny;
