/**
 * Liftable — utility type for accepting CExprs at any leaf position.
 *
 * Used by plugins that accept complex object parameters. Allows users
 * to embed CExpr values anywhere a primitive or sub-object is expected.
 */

import type { CExpr } from "./expr";

/**
 * Recursively allows `CExpr<X>` wherever `X` is expected in a type.
 *
 * - Primitives (string, number, boolean): accept plain value or `CExpr`
 * - null/undefined: pass through unchanged
 * - Arrays: each element is `Liftable`
 * - Objects: each field is `Liftable`, or the whole object can be a `CExpr`
 */
export type Liftable<T> =
  T extends CExpr<any, any, any>
    ? T
    : T extends string
      ? T | CExpr<string, any, any>
      : T extends number
        ? T | CExpr<number, any, any>
        : T extends boolean
          ? T | CExpr<boolean, any, any>
          : T extends null | undefined
            ? T
            : T extends readonly (infer E)[]
              ? readonly Liftable<E>[] | CExpr<T, any, any>
              : T extends object
                ? { [K in keyof T]: Liftable<T[K]> } | CExpr<T, any, any>
                : T | CExpr<T, any, any>;
