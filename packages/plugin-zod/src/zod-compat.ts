import { z } from "zod";

function invokeZodMethod<TReturn>(target: unknown, methodName: string, args: unknown[]): TReturn {
  const candidate = (target as Record<string, unknown>)[methodName];
  if (typeof candidate !== "function") {
    throw new Error(`Zod compatibility: method ${methodName} is not available`);
  }
  return (candidate as (...methodArgs: unknown[]) => TReturn).apply(target, args);
}

/** Zod v4 method not present on the public `ZodType` typing surface. */
export function zodNonoptional(schema: z.ZodType): z.ZodType {
  return invokeZodMethod<z.ZodType>(schema, "nonoptional", []);
}

/** Zod v4 method not present on the public `ZodType` typing surface. */
export function zodPrefault(schema: z.ZodType, value: unknown): z.ZodType {
  return invokeZodMethod<z.ZodType>(schema, "prefault", [value]);
}

/** Zod v4 tuple rest helper not present on the public tuple typing surface. */
export function zodTupleRest(tuple: z.ZodType, rest: z.ZodType): z.ZodType {
  return invokeZodMethod<z.ZodType>(tuple, "rest", [rest]);
}

/** Zod v4 xor helper not present on the public `z` namespace typing surface. */
export function zodXor(
  options: [z.ZodType, z.ZodType, ...z.ZodType[]],
  error?: { error?: (iss: unknown) => string },
): z.ZodType {
  return invokeZodMethod<z.ZodType>(z, "xor", error ? [options, error] : [options]);
}

/** Zod v4 partialRecord helper not present on the public `z` namespace typing surface. */
export function zodPartialRecord(
  keySchema: z.ZodType,
  valueSchema: z.ZodType,
  error?: { error?: (iss: unknown) => string },
): z.ZodType {
  return invokeZodMethod<z.ZodType>(
    z,
    "partialRecord",
    error ? [keySchema, valueSchema, error] : [keySchema, valueSchema],
  );
}

/** Zod v4 looseRecord helper not present on the public `z` namespace typing surface. */
export function zodLooseRecord(
  keySchema: z.ZodType,
  valueSchema: z.ZodType,
  error?: { error?: (iss: unknown) => string },
): z.ZodType {
  return invokeZodMethod<z.ZodType>(
    z,
    "looseRecord",
    error ? [keySchema, valueSchema, error] : [keySchema, valueSchema],
  );
}
