import type { TypedNode } from "@mvfm/core";
import type { z } from "zod";
import type { CheckDescriptor, ErrorConfig } from "./types";

export type SchemaInterpreterMap = Record<
  string,
  (node: any) => AsyncGenerator<TypedNode, z.ZodType, unknown>
>;

/**
 * Convert an ErrorConfig (string or ASTNode) to a Zod-compatible error function.
 * String errors become a function that returns the string for all issues.
 * ASTNode errors would need interpreter context to evaluate — stored as descriptive string.
 */
export function toZodError(error: ErrorConfig | undefined): ((iss: unknown) => string) | undefined {
  if (error === undefined) return undefined;
  if (typeof error === "string") return () => error;
  return () => `[dynamic error: ${JSON.stringify(error)}]`;
}

/**
 * Build check-level error option for Zod check methods.
 * Returns `{ error: fn }` if error is present, otherwise empty object.
 */
export function checkErrorOpt(check: CheckDescriptor): { error?: (iss: unknown) => string } {
  const fn = toZodError(check.error as ErrorConfig | undefined);
  return fn ? { error: fn } : {};
}
