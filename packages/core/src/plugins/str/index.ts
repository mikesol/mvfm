/**
 * DAG-model str plugin definition.
 *
 * Provides string manipulation operations as CExpr builders.
 */

import type { PluginDefWithBuild, BuildContext } from "../../dag/builder";
import { createStrDagInterpreter } from "./interpreter";
import type { CExpr } from "../../dag/00-expr";

type E<T = unknown> = CExpr<T, string, unknown>;

/** DAG-model str plugin definition. */
export const strDagPlugin: PluginDefWithBuild = {
  name: "str",
  nodeKinds: [
    "str/template",
    "str/concat",
    "str/upper",
    "str/lower",
    "str/trim",
    "str/slice",
    "str/includes",
    "str/startsWith",
    "str/endsWith",
    "str/split",
    "str/join",
    "str/replace",
    "str/len",
    "str/eq",
    "str/show",
    "str/append",
    "str/mempty",
  ],
  defaultInterpreter: createStrDagInterpreter,
  build(ctx: BuildContext): Record<string, unknown> {
    return {
      str: {
        /** Create a string literal. */
        literal: (value: string) => ctx.core.literal(value),
        /** Concatenate multiple strings. */
        concat: (...parts: E<string>[]) =>
          ctx.node("str/concat", parts),
        /** Template literal: strings[] stored in out, exprs as children. */
        template: (strings: string[], ...exprs: E[]) =>
          ctx.node("str/template", exprs, strings),
        /** Convert to uppercase. */
        upper: (s: E<string>) => ctx.node("str/upper", [s]),
        /** Convert to lowercase. */
        lower: (s: E<string>) => ctx.node("str/lower", [s]),
        /** Trim whitespace. */
        trim: (s: E<string>) => ctx.node("str/trim", [s]),
        /** Slice a string. */
        slice: (s: E<string>, start: E<number>, end?: E<number>) =>
          end
            ? ctx.node("str/slice", [s, start, end])
            : ctx.node("str/slice", [s, start]),
        /** Test if haystack includes needle. */
        includes: (haystack: E<string>, needle: E<string>) =>
          ctx.node("str/includes", [haystack, needle]),
        /** Test if string starts with prefix. */
        startsWith: (s: E<string>, prefix: E<string>) =>
          ctx.node("str/startsWith", [s, prefix]),
        /** Test if string ends with suffix. */
        endsWith: (s: E<string>, suffix: E<string>) =>
          ctx.node("str/endsWith", [s, suffix]),
        /** Split string by delimiter. */
        split: (s: E<string>, delimiter: E<string>) =>
          ctx.node("str/split", [s, delimiter]),
        /** Join array with separator. */
        join: (arr: E<string[]>, separator: E<string>) =>
          ctx.node("str/join", [arr, separator]),
        /** Replace first occurrence. */
        replace: (s: E<string>, search: E<string>, replacement: E<string>) =>
          ctx.node("str/replace", [s, search, replacement]),
        /** Get string length. */
        len: (s: E<string>) => ctx.node("str/len", [s]),
        /** String equality. */
        eq: (a: E<string>, b: E<string>) =>
          ctx.node("str/eq", [a, b]),
        /** Show (identity for strings). */
        show: (s: E<string>) => ctx.node("str/show", [s]),
        /** Semigroup append (concatenation). */
        append: (a: E<string>, b: E<string>) =>
          ctx.node("str/append", [a, b]),
        /** Monoid mempty (empty string). */
        mempty: () => ctx.node("str/mempty", []),
      },
    };
  },
};
