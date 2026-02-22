import type { Interpreter } from "@mvfm/core";
import { createS3Interpreter, type S3Client } from "./interpreter";

/**
 * Creates a server-side interpreter for `s3/*` node kinds.
 *
 * @param client - The {@link S3Client} to execute against.
 * @returns An Interpreter for s3 node kinds.
 */
export function serverInterpreter(client: S3Client): Interpreter {
  return createS3Interpreter(client);
}

/**
 * Creates a combined interpreter merging s3 handlers with a base interpreter.
 *
 * @param client - The {@link S3Client} to execute against.
 * @param baseInterpreter - Base interpreter for evaluating sub-expressions.
 * @returns A merged Interpreter for both base and s3 node kinds.
 */
export function serverEvaluate(client: S3Client, baseInterpreter: Interpreter): Interpreter {
  return { ...baseInterpreter, ...createS3Interpreter(client) };
}
