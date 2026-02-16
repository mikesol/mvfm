import type { Interpreter, TypedNode } from "@mvfm/core";
import { foldAST } from "@mvfm/core";
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
 * Creates a unified evaluator using the s3 server interpreter.
 *
 * @param client - The {@link S3Client} to execute against.
 * @param baseInterpreter - Base interpreter for evaluating sub-expressions.
 * @returns An async AST evaluator function.
 */
export function serverEvaluate(
  client: S3Client,
  baseInterpreter: Interpreter,
): (root: TypedNode) => Promise<unknown> {
  const interp = { ...baseInterpreter, ...createS3Interpreter(client) };
  return (root: TypedNode) => foldAST(interp, root);
}
