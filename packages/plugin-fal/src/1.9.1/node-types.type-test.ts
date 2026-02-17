import { typedInterpreter } from "@mvfm/core";

const _falBadAny = typedInterpreter<"fal/run">()({
  // @ts-expect-error `node:any` must be rejected once fal kind is registered in NodeTypeMap
  // biome-ignore lint/correctness/useYield: compile-time type test
  "fal/run": async function* (node: any) {
    return node;
  },
});
