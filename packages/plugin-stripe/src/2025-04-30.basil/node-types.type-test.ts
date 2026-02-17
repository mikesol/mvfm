import { typedInterpreter } from "@mvfm/core";

const _stripeBadAny = typedInterpreter<"stripe/create_payment_intent">()({
  // @ts-expect-error `node:any` must be rejected once stripe kind is registered in NodeTypeMap
  // biome-ignore lint/correctness/useYield: compile-time type test
  "stripe/create_payment_intent": async function* (node: any) {
    return node;
  },
});
