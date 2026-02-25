import type { Interpreter, RuntimeEntry } from "@mvfm/core";
import { resolveStructured } from "@mvfm/core";

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

/**
 * Creates an interpreter for `s3/*` node kinds using the new
 * RuntimeEntry + positional yield pattern.
 *
 * @param client - The {@link S3Client} to execute against.
 * @returns An Interpreter handling all s3 node kinds.
 */
export function createS3Interpreter(client: S3Client): Interpreter {
  return {
    "s3/put_object": async function* (entry: RuntimeEntry) {
      const input = yield* resolveStructured(entry.children[0]);
      return await client.execute("PutObject", input as Record<string, unknown>);
    },

    "s3/get_object": async function* (entry: RuntimeEntry) {
      const input = yield* resolveStructured(entry.children[0]);
      return await client.execute("GetObject", input as Record<string, unknown>);
    },

    "s3/delete_object": async function* (entry: RuntimeEntry) {
      const input = yield* resolveStructured(entry.children[0]);
      return await client.execute("DeleteObject", input as Record<string, unknown>);
    },

    "s3/head_object": async function* (entry: RuntimeEntry) {
      const input = yield* resolveStructured(entry.children[0]);
      return await client.execute("HeadObject", input as Record<string, unknown>);
    },

    "s3/list_objects_v2": async function* (entry: RuntimeEntry) {
      const input = yield* resolveStructured(entry.children[0]);
      return await client.execute("ListObjectsV2", input as Record<string, unknown>);
    },
  };
}
