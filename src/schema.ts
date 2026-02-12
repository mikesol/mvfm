// ---- Schema Types ----------------------------------------
// Runtime type tags that double as TypeScript type-level markers.
// See design doc: docs/plans/2026-02-12-typeclass-dispatch-design.md

export type SchemaTag = "string" | "number" | "boolean" | "date" | "null";

export interface ArraySchema {
  readonly __tag: "array";
  readonly of: SchemaType;
}

export interface NullableSchema {
  readonly __tag: "nullable";
  readonly of: SchemaType;
}

export type SchemaType =
  | SchemaTag
  | ArraySchema
  | NullableSchema
  | { readonly [key: string]: SchemaType };

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

export function array(of: SchemaType): ArraySchema {
  return { __tag: "array", of };
}

export function nullable(of: SchemaType): NullableSchema {
  return { __tag: "nullable", of };
}
