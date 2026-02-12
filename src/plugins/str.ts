import type { Expr, PluginContext, PluginDefinition } from "../core";

export interface StrMethods {
  /** Tagged template literal: $.str`hello ${name}` */
  str(strings: TemplateStringsArray, ...exprs: (Expr<any> | string | number)[]): Expr<string>;
  concat(...parts: (Expr<string> | string)[]): Expr<string>;
  upper(s: Expr<string> | string): Expr<string>;
  lower(s: Expr<string> | string): Expr<string>;
  trim(s: Expr<string> | string): Expr<string>;
  slice(
    s: Expr<string> | string,
    start: Expr<number> | number,
    end?: Expr<number> | number,
  ): Expr<string>;
  includes(haystack: Expr<string> | string, needle: Expr<string> | string): Expr<boolean>;
  startsWith(s: Expr<string> | string, prefix: Expr<string> | string): Expr<boolean>;
  endsWith(s: Expr<string> | string, suffix: Expr<string> | string): Expr<boolean>;
  split(s: Expr<string> | string, delimiter: Expr<string> | string): Expr<string[]>;
  join(arr: Expr<string[]>, separator: Expr<string> | string): Expr<string>;
  replace(
    s: Expr<string> | string,
    search: Expr<string> | string,
    replacement: Expr<string> | string,
  ): Expr<string>;
  len(s: Expr<string> | string): Expr<number>;
}

export const str: PluginDefinition<StrMethods> = {
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
  ],
  traits: { eq: { type: "string", nodeKind: "str/eq" } },
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
};
