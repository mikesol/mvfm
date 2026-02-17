import { defineInterpreter } from "@mvfm/core";

const _consoleBadAny = defineInterpreter<"console/log">()({
  // @ts-expect-error `node:any` must be rejected once console kind is registered in NodeTypeMap
  // biome-ignore lint/correctness/useYield: compile-time type test
  "console/log": async function* (node: any) {
    return node;
  },
});
