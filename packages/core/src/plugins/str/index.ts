import type { Expr, PluginContext } from "../../core";
import { definePlugin } from "../../core";
import { strInterpreter } from "./interpreter";

/**
 * String manipulation operations.
 *
 * All methods accept raw strings or `Expr<string>` (auto-lifted).
 */
export interface StrMethods {
  /** Tagged template literal for string interpolation. */
  str(strings: TemplateStringsArray, ...exprs: (Expr<any> | string | number)[]): Expr<string>;
  /** Concatenate multiple string values. */
  concat(...parts: (Expr<string> | string)[]): Expr<string>;
  /** Convert to uppercase. */
  upper(s: Expr<string> | string): Expr<string>;
  /** Convert to lowercase. */
  lower(s: Expr<string> | string): Expr<string>;
  /** Remove leading and trailing whitespace. */
  trim(s: Expr<string> | string): Expr<string>;
  /** Extract a substring by start/end index. */
  slice(
    s: Expr<string> | string,
    start: Expr<number> | number,
    end?: Expr<number> | number,
  ): Expr<string>;
  /** Test whether a string contains a substring. */
  includes(haystack: Expr<string> | string, needle: Expr<string> | string): Expr<boolean>;
  /** Test whether a string starts with a prefix. */
  startsWith(s: Expr<string> | string, prefix: Expr<string> | string): Expr<boolean>;
  /** Test whether a string ends with a suffix. */
  endsWith(s: Expr<string> | string, suffix: Expr<string> | string): Expr<boolean>;
  /** Split a string by delimiter into an array. */
  split(s: Expr<string> | string, delimiter: Expr<string> | string): Expr<string[]>;
  /** Join an array of strings with a separator. */
  join(arr: Expr<string[]>, separator: Expr<string> | string): Expr<string>;
  /** Replace the first occurrence of a search string. */
  replace(
    s: Expr<string> | string,
    search: Expr<string> | string,
    replacement: Expr<string> | string,
  ): Expr<string>;
  /** Get the length of a string. */
  len(s: Expr<string> | string): Expr<number>;
}

/**
 * String operations plugin. Namespace: `str/`.
 *
 * Provides template literals, concatenation, case conversion, search, and
 * splitting. Registers trait implementations for eq, show, semigroup, and monoid.
 */
export const str = definePlugin({
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
  defaultInterpreter: strInterpreter,
  traits: {
    eq: { type: "string", nodeKinds: { eq: "str/eq" } },
    show: { type: "string", nodeKinds: { show: "str/show" } },
    semigroup: { type: "string", nodeKinds: { append: "str/append" } },
    monoid: { type: "string", nodeKinds: { mempty: "str/mempty" } },
  },
  build(ctx: PluginContext): StrMethods {
    return {
      str(strings: TemplateStringsArray, ...exprs: (Expr<any> | string | number)[]) {
        return ctx.expr<string>({
          kind: "str/template",
          strings: Array.from(strings),
          exprs: exprs.map((e) => ctx.lift(e).__node),
        });
      },
      concat(...parts) {
        return ctx.expr<string>({
          kind: "str/concat",
          parts: parts.map((p) => ctx.lift(p).__node),
        });
      },
      upper: (s) => ctx.expr<string>({ kind: "str/upper", operand: ctx.lift(s).__node }),
      lower: (s) => ctx.expr<string>({ kind: "str/lower", operand: ctx.lift(s).__node }),
      trim: (s) => ctx.expr<string>({ kind: "str/trim", operand: ctx.lift(s).__node }),
      slice: (s, start, end) =>
        ctx.expr<string>({
          kind: "str/slice",
          operand: ctx.lift(s).__node,
          start: ctx.lift(start).__node,
          ...(end !== undefined ? { end: ctx.lift(end).__node } : {}),
        }),
      includes: (h, n) =>
        ctx.expr<boolean>({
          kind: "str/includes",
          haystack: ctx.lift(h).__node,
          needle: ctx.lift(n).__node,
        }),
      startsWith: (s, p) =>
        ctx.expr<boolean>({
          kind: "str/startsWith",
          operand: ctx.lift(s).__node,
          prefix: ctx.lift(p).__node,
        }),
      endsWith: (s, su) =>
        ctx.expr<boolean>({
          kind: "str/endsWith",
          operand: ctx.lift(s).__node,
          suffix: ctx.lift(su).__node,
        }),
      split: (s, d) =>
        ctx.expr<string[]>({
          kind: "str/split",
          operand: ctx.lift(s).__node,
          delimiter: ctx.lift(d).__node,
        }),
      join: (arr, sep) =>
        ctx.expr<string>({
          kind: "str/join",
          array: arr.__node,
          separator: ctx.lift(sep).__node,
        }),
      replace: (s, search, replacement) =>
        ctx.expr<string>({
          kind: "str/replace",
          operand: ctx.lift(s).__node,
          search: ctx.lift(search).__node,
          replacement: ctx.lift(replacement).__node,
        }),
      len: (s) => ctx.expr<number>({ kind: "str/len", operand: ctx.lift(s).__node }),
    };
  },
});
