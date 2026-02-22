/**
 * String plugin — full prelude surface for str operations.
 *
 * Split from std-plugins.ts to stay under 300-line limit.
 */

import {
  concat,
  endsWith,
  includes,
  join,
  len,
  lower,
  replace,
  slice,
  split,
  startsWith,
  str,
  strAppend,
  strLit,
  strShow,
  trim,
  upper,
} from "./constructors";
import type { Interpreter, TraitDef } from "./plugin";
import type { KindSpec } from "./registry";

/** Unified string operations plugin with interpreter. */
export const strPlugin = {
  name: "str",
  ctors: {
    strLit,
    str,
    concat,
    upper,
    lower,
    trim,
    slice,
    includes,
    startsWith,
    endsWith,
    split,
    join,
    replace,
    len,
    strShow,
    strAppend,
  },
  kinds: {
    "str/literal": { inputs: [], output: "" as string } as KindSpec<[], string>,
    "str/concat": { inputs: [] as string[], output: "" as string } as KindSpec<string[], string>,
    "str/upper": { inputs: [""] as [string], output: "" as string } as KindSpec<[string], string>,
    "str/lower": { inputs: [""] as [string], output: "" as string } as KindSpec<[string], string>,
    "str/trim": { inputs: [""] as [string], output: "" as string } as KindSpec<[string], string>,
    "str/slice": {
      inputs: ["", 0, 0] as [string, number, number],
      output: "" as string,
    } as KindSpec<[string, number, number], string>,
    "str/includes": {
      inputs: ["", ""] as [string, string],
      output: false as boolean,
    } as KindSpec<[string, string], boolean>,
    "str/startsWith": {
      inputs: ["", ""] as [string, string],
      output: false as boolean,
    } as KindSpec<[string, string], boolean>,
    "str/endsWith": {
      inputs: ["", ""] as [string, string],
      output: false as boolean,
    } as KindSpec<[string, string], boolean>,
    "str/split": {
      inputs: ["", ""] as [string, string],
      output: [] as string[],
    } as KindSpec<[string, string], string[]>,
    "str/join": {
      inputs: [[] as string[], ""] as [string[], string],
      output: "" as string,
    } as KindSpec<[string[], string], string>,
    "str/replace": {
      inputs: ["", "", ""] as [string, string, string],
      output: "" as string,
    } as KindSpec<[string, string, string], string>,
    "str/len": { inputs: [""] as [string], output: 0 as number } as KindSpec<[string], number>,
    "str/show": { inputs: [""] as [string], output: "" as string } as KindSpec<[string], string>,
    "str/append": {
      inputs: ["", ""] as [string, string],
      output: "" as string,
    } as KindSpec<[string, string], string>,
    "str/mempty": { inputs: [], output: "" as string } as KindSpec<[], string>,
    "str/eq": {
      inputs: ["", ""] as [string, string],
      output: false as boolean,
    } as KindSpec<[string, string], boolean>,
    "str/neq": {
      inputs: ["", ""] as [string, string],
      output: false as boolean,
    } as KindSpec<[string, string], boolean>,
  },
  traits: {
    eq: { output: false as boolean, mapping: { string: "str/eq" } } as TraitDef<
      boolean,
      { string: "str/eq" }
    >,
    neq: { output: false as boolean, mapping: { string: "str/neq" } } as TraitDef<
      boolean,
      { string: "str/neq" }
    >,
    show: { output: "" as string, mapping: { string: "str/show" } } as TraitDef<
      string,
      { string: "str/show" }
    >,
    append: { output: "" as string, mapping: { string: "str/append" } } as TraitDef<
      string,
      { string: "str/append" }
    >,
  },
  lifts: { string: "str/literal" },
  nodeKinds: [
    "str/literal",
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
    "str/show",
    "str/append",
    "str/mempty",
    "str/eq",
    "str/neq",
  ],
  defaultInterpreter: (): Interpreter => ({
    "str/literal": async function* (e) {
      return e.out as string;
    },
    "str/concat": async function* (e) {
      const parts: string[] = [];
      for (let i = 0; i < e.children.length; i++) parts.push((yield i) as string);
      return parts.join("");
    },
    "str/upper": async function* () {
      return String((yield 0) as string).toUpperCase();
    },
    "str/lower": async function* () {
      return String((yield 0) as string).toLowerCase();
    },
    "str/trim": async function* () {
      return String((yield 0) as string).trim();
    },
    "str/slice": async function* (e) {
      const s = String((yield 0) as string);
      const start = (yield 1) as number;
      return e.children.length > 2 ? s.slice(start, (yield 2) as number) : s.slice(start);
    },
    "str/includes": async function* () {
      return String((yield 0) as string).includes((yield 1) as string);
    },
    "str/startsWith": async function* () {
      return String((yield 0) as string).startsWith((yield 1) as string);
    },
    "str/endsWith": async function* () {
      return String((yield 0) as string).endsWith((yield 1) as string);
    },
    "str/split": async function* () {
      return String((yield 0) as string).split((yield 1) as string);
    },
    "str/join": async function* () {
      return ((yield 0) as string[]).join((yield 1) as string);
    },
    "str/replace": async function* () {
      return String((yield 0) as string).replace((yield 1) as string, (yield 2) as string);
    },
    "str/len": async function* () {
      return String((yield 0) as string).length;
    },
    "str/show": async function* () {
      return String((yield 0) as string);
    },
    "str/append": async function* () {
      return String((yield 0) as string) + String((yield 1) as string);
    },
    "str/mempty": async function* () {
      return "";
    },
    "str/eq": async function* () {
      return ((yield 0) as string) === ((yield 1) as string);
    },
    "str/neq": async function* () {
      return ((yield 0) as string) !== ((yield 1) as string);
    },
  }),
} as const;
