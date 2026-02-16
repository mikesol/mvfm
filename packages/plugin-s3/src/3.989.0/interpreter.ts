import type { Interpreter, TypedNode } from "@mvfm/core";
import { eval_ } from "@mvfm/core";

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

/** Map from AST node kind to S3 command name. */
const COMMAND_MAP: Record<string, string> = {
  "s3/put_object": "PutObject",
  "s3/get_object": "GetObject",
  "s3/delete_object": "DeleteObject",
  "s3/head_object": "HeadObject",
  "s3/list_objects_v2": "ListObjectsV2",
};

interface S3Node extends TypedNode<unknown> {
  kind: string;
  input: TypedNode<Record<string, unknown>>;
}

/**
 * Creates an interpreter for `s3/*` node kinds.
 *
 * @param client - The {@link S3Client} to execute against.
 * @returns An Interpreter handling all s3 node kinds.
 */
export function createS3Interpreter(client: S3Client): Interpreter {
  const handler = async function* (node: S3Node) {
    const command = COMMAND_MAP[node.kind];
    if (!command) throw new Error(`S3 interpreter: unknown node kind "${node.kind}"`);
    const input = yield* eval_(node.input);
    return await client.execute(command, input);
  };

  return Object.fromEntries(Object.keys(COMMAND_MAP).map((kind) => [kind, handler]));
}
