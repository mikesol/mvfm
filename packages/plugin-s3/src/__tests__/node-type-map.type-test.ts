import type { TypedNode } from "@mvfm/core";
import { defineInterpreter } from "@mvfm/core";
import type { S3GetObjectNode, S3PutObjectNode } from "../3.989.0/interpreter";

const _s3Positive = defineInterpreter<"s3/put_object" | "s3/get_object">()({
  // biome-ignore lint/correctness/useYield: compile-time signature test
  "s3/put_object": async function* (_node: S3PutObjectNode) {
    return { $metadata: {} };
  },
  // biome-ignore lint/correctness/useYield: compile-time signature test
  "s3/get_object": async function* (_node: S3GetObjectNode) {
    return { $metadata: {} };
  },
});

const _s3BadAny = defineInterpreter<"s3/put_object">()({
  // @ts-expect-error registered kind cannot use any node parameter
  // biome-ignore lint/correctness/useYield: compile-time signature test
  "s3/put_object": async function* (_node: any) {
    return {};
  },
});

interface WrongS3Node extends TypedNode<number> {
  kind: "s3/get_object";
}

const _s3BadNode = defineInterpreter<"s3/get_object">()({
  // @ts-expect-error wrong node shape for s3/get_object
  // biome-ignore lint/correctness/useYield: compile-time signature test
  "s3/get_object": async function* (_node: WrongS3Node) {
    return 1;
  },
});
