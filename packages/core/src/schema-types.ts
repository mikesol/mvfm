/**
 * Schema-to-type mapping utilities for input schema enforcement.
 *
 * Maps schema descriptor strings ("number", "string", "boolean", "number[]")
 * to their corresponding TypeScript types at compile time.
 */

/** Map a schema type string to its TypeScript type. Handles `"number"`, `"string"`, `"boolean"`, and array forms like `"number[]"`. */
export type SchemaToType<S extends string> = S extends `${infer E}[]`
  ? SchemaToType<E>[]
  : S extends "number"
    ? number
    : S extends "string"
      ? string
      : S extends "boolean"
        ? boolean
        : unknown;

/** Convert a schema record `{ x: "number", y: "string" }` to `{ x: number, y: string }`. */
export type SchemaToData<S extends Record<string, string>> = { [K in keyof S]: SchemaToType<S[K]> };
