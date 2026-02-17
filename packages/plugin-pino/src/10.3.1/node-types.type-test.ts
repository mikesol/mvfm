import { typedInterpreter } from "@mvfm/core";

const _pinoBadAny = typedInterpreter<"pino/info">()({
  // @ts-expect-error `node:any` must be rejected once pino kind is registered in NodeTypeMap
  // biome-ignore lint/correctness/useYield: compile-time type test
  "pino/info": async function* (node: any) {
    return node;
  },
});
