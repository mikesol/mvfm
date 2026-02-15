import type { ASTNode, InterpreterFragment, StepEffect } from "../../../core";

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

/**
 * Generator-based interpreter fragment for s3 plugin nodes.
 *
 * Yields `s3/command` effects for all 5 operations. Each effect
 * contains the command name and resolved input, matching the
 * AWS SDK command pattern.
 */
export const s3Interpreter: InterpreterFragment = {
  pluginName: "s3",
  canHandle: (node) => node.kind.startsWith("s3/"),
  *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
    const command = COMMAND_MAP[node.kind];
    if (!command) {
      throw new Error(`S3 interpreter: unknown node kind "${node.kind}"`);
    }

    const input = yield { type: "recurse", child: node.input as ASTNode };
    return yield {
      type: "s3/command",
      command,
      input,
    };
  },
};
