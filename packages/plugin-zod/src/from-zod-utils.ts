type AnySchema = { _def?: Record<string, unknown>; def?: Record<string, unknown> };

/**
 * Reads the internal definition object from a runtime Zod schema.
 *
 * @throws Error When no definition object can be found.
 */
export function readSchemaDef(schema: unknown): Record<string, unknown> {
  const def = (schema as AnySchema)?._def ?? (schema as AnySchema)?.def;
  if (!def || typeof def !== "object") {
    throw new Error("zod.from: unable to read schema definition");
  }
  return def;
}

/**
 * Throws in strict mode, otherwise appends a warning message.
 *
 * @throws Error When `strict` is true.
 */
export function warnOrThrow(
  strict: boolean,
  warnings: string[],
  path: string,
  message: string,
): void {
  const text = `${path}: ${message}`;
  if (strict) throw new Error(`zod.from strict mode: ${text}`);
  warnings.push(text);
}
