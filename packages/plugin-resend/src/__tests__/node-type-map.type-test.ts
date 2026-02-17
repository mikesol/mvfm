import { defineInterpreter } from "@mvfm/core";

const _positive = defineInterpreter<"resend/send_email">()({
  // biome-ignore lint/correctness/useYield: type-level compile test
  "resend/send_email": async function* (node) {
    return node;
  },
});

const _negativeAny = defineInterpreter<"resend/send_email">()({
  // @ts-expect-error should reject node:any once kind is registered in NodeTypeMap
  // biome-ignore lint/correctness/useYield: type-level compile test
  "resend/send_email": async function* (node: any) {
    return node;
  },
});

void _positive;
void _negativeAny;
