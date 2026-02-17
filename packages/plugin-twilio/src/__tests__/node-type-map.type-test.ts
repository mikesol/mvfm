import { typedInterpreter } from "@mvfm/core";

const _positive = typedInterpreter<"twilio/create_message">()({
  // biome-ignore lint/correctness/useYield: type-level compile test
  "twilio/create_message": async function* (node) {
    return node;
  },
});

const _negativeAny = typedInterpreter<"twilio/create_message">()({
  // @ts-expect-error should reject node:any once kind is registered in NodeTypeMap
  // biome-ignore lint/correctness/useYield: type-level compile test
  "twilio/create_message": async function* (node: any) {
    return node;
  },
});

void _positive;
void _negativeAny;
