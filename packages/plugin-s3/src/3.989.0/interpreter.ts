import type {
  DeleteObjectCommandInput,
  DeleteObjectCommandOutput,
  GetObjectCommandInput,
  GetObjectCommandOutput,
  HeadObjectCommandInput,
  HeadObjectCommandOutput,
  ListObjectsV2CommandInput,
  ListObjectsV2CommandOutput,
  PutObjectCommandInput,
  PutObjectCommandOutput,
} from "@aws-sdk/client-s3";
import type { Interpreter, TypedNode } from "@mvfm/core";
import { eval_, typedInterpreter } from "@mvfm/core";

/**
 * S3 client interface consumed by the s3 handler.
 *
 * Abstracts over the actual AWS S3 SDK so handlers can be
 * tested with mock clients.
 */
export interface S3Client {
  /** Execute an S3 command and return the response. */
  execute(command: string, input: Record<string, unknown>): Promise<unknown>;
}

/** A `s3/put_object` node for PutObject execution. */
export interface S3PutObjectNode extends TypedNode<PutObjectCommandOutput> {
  kind: "s3/put_object";
  input: TypedNode<PutObjectCommandInput>;
}

/** A `s3/get_object` node for GetObject execution. */
export interface S3GetObjectNode extends TypedNode<GetObjectCommandOutput> {
  kind: "s3/get_object";
  input: TypedNode<GetObjectCommandInput>;
}

/** A `s3/delete_object` node for DeleteObject execution. */
export interface S3DeleteObjectNode extends TypedNode<DeleteObjectCommandOutput> {
  kind: "s3/delete_object";
  input: TypedNode<DeleteObjectCommandInput>;
}

/** A `s3/head_object` node for HeadObject execution. */
export interface S3HeadObjectNode extends TypedNode<HeadObjectCommandOutput> {
  kind: "s3/head_object";
  input: TypedNode<HeadObjectCommandInput>;
}

/** A `s3/list_objects_v2` node for ListObjectsV2 execution. */
export interface S3ListObjectsV2Node extends TypedNode<ListObjectsV2CommandOutput> {
  kind: "s3/list_objects_v2";
  input: TypedNode<ListObjectsV2CommandInput>;
}

type S3Kind =
  | "s3/put_object"
  | "s3/get_object"
  | "s3/delete_object"
  | "s3/head_object"
  | "s3/list_objects_v2";

declare module "@mvfm/core" {
  interface NodeTypeMap {
    "s3/put_object": S3PutObjectNode;
    "s3/get_object": S3GetObjectNode;
    "s3/delete_object": S3DeleteObjectNode;
    "s3/head_object": S3HeadObjectNode;
    "s3/list_objects_v2": S3ListObjectsV2Node;
  }
}

/**
 * Creates an interpreter for `s3/*` node kinds.
 *
 * @param client - The {@link S3Client} to execute against.
 * @returns An Interpreter handling all s3 node kinds.
 */
export function createS3Interpreter(client: S3Client): Interpreter {
  return typedInterpreter<S3Kind>()({
    "s3/put_object": async function* (node: S3PutObjectNode) {
      const input = yield* eval_(node.input);
      return (await client.execute(
        "PutObject",
        input as unknown as Record<string, unknown>,
      )) as PutObjectCommandOutput;
    },
    "s3/get_object": async function* (node: S3GetObjectNode) {
      const input = yield* eval_(node.input);
      return (await client.execute(
        "GetObject",
        input as unknown as Record<string, unknown>,
      )) as GetObjectCommandOutput;
    },
    "s3/delete_object": async function* (node: S3DeleteObjectNode) {
      const input = yield* eval_(node.input);
      return (await client.execute(
        "DeleteObject",
        input as unknown as Record<string, unknown>,
      )) as DeleteObjectCommandOutput;
    },
    "s3/head_object": async function* (node: S3HeadObjectNode) {
      const input = yield* eval_(node.input);
      return (await client.execute(
        "HeadObject",
        input as unknown as Record<string, unknown>,
      )) as HeadObjectCommandOutput;
    },
    "s3/list_objects_v2": async function* (node: S3ListObjectsV2Node) {
      const input = yield* eval_(node.input);
      return (await client.execute(
        "ListObjectsV2",
        input as unknown as Record<string, unknown>,
      )) as ListObjectsV2CommandOutput;
    },
  });
}
