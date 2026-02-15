// ---- Schema Types ----------------------------------------
// Runtime type tags that double as TypeScript type-level markers.
// See design doc: docs/plans/2026-02-12-typeclass-dispatch-design.md

/**
 * Primitive runtime type tags used in schema declarations.
 */
export type SchemaTag = "string" | "number" | "boolean" | "date" | "null";

/**
 * Schema type representing an array of elements.
 */
export interface ArraySchema {
  readonly __tag: "array";
  readonly of: SchemaType;
}

/**
 * Schema type representing a nullable value.
 */
export interface NullableSchema {
  readonly __tag: "nullable";
  readonly of: SchemaType;
}

/**
 * A schema type: a primitive tag, array, nullable, or nested record.
 */
export type SchemaType =
  | SchemaTag
  | ArraySchema
  | NullableSchema
  | { readonly [key: string]: SchemaType };

/**
 * A record mapping field names to schema types, used to declare program input shapes.
 */
export type SchemaShape = Record<string, SchemaType>;

// ---- Type-level inference --------------------------------

type TagToType<T> = T extends "string"
  ? string
  : T extends "number"
    ? number
    : T extends "boolean"
      ? boolean
      : T extends "date"
        ? Date
        : T extends "null"
          ? null
          : never;

/**
 * Infers a TypeScript type from a runtime schema declaration.
 *
 * Maps {@link SchemaTag} primitives to their TS equivalents and recursively
 * resolves arrays, nullables, and nested records.
 */
export type InferSchema<S> = S extends SchemaTag
  ? TagToType<S>
  : S extends { __tag: "array"; of: infer U }
    ? InferSchema<U>[]
    : S extends { __tag: "nullable"; of: infer U }
      ? InferSchema<U> | null
      : S extends Record<string, unknown>
        ? { [K in keyof S]: InferSchema<S[K]> }
        : never;

// ---- Runtime helpers -------------------------------------

/**
 * Creates an array schema type.
 *
 * @param of - The element schema type.
 * @returns An {@link ArraySchema} descriptor.
 *
 * @example
 * ```ts
 * const schema = { tags: array("string") };
 * ```
 */
export function array(of: SchemaType): ArraySchema {
  return { __tag: "array", of };
}

/**
 * Creates a nullable schema type.
 *
 * @param of - The inner schema type that may be null.
 * @returns A {@link NullableSchema} descriptor.
 *
 * @example
 * ```ts
 * const schema = { nickname: nullable("string") };
 * ```
 */
export function nullable(of: SchemaType): NullableSchema {
  return { __tag: "nullable", of };
}
