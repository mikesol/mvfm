/**
 * DAG-model interpreter for str/* node kinds.
 *
 * Uses positional child indices (yield 0, yield 1, etc.)
 * compatible with the fold() trampoline evaluator.
 *
 * Child layout per kind:
 * - str/template: children[0..N-1] are interpolation expressions, `out` holds strings[]
 * - str/concat: children[0..N-1] are parts
 * - str/upper, str/lower, str/trim, str/show: child 0 = operand
 * - str/len: child 0 = operand
 * - str/slice: child 0 = operand, child 1 = start, child 2 = end (optional)
 * - str/includes: child 0 = haystack, child 1 = needle
 * - str/startsWith: child 0 = operand, child 1 = prefix
 * - str/endsWith: child 0 = operand, child 1 = suffix
 * - str/split: child 0 = operand, child 1 = delimiter
 * - str/join: child 0 = array, child 1 = separator
 * - str/replace: child 0 = operand, child 1 = search, child 2 = replacement
 * - str/eq: child 0 = left, child 1 = right
 * - str/append: child 0 = left, child 1 = right
 * - str/mempty: no children, returns ""
 */

import type { Interpreter } from "../../dag/fold";

/** Create the str plugin interpreter for fold(). */
export function createStrDagInterpreter(): Interpreter {
  return {
    "str/template": async function* (entry) {
      const strings = entry.out as string[];
      let result = strings[0];
      for (let i = 0; i < entry.children.length; i++) {
        result += String(yield i);
        result += strings[i + 1];
      }
      return result;
    },
    "str/concat": async function* (entry) {
      const parts: string[] = [];
      for (let i = 0; i < entry.children.length; i++) {
        parts.push((yield i) as string);
      }
      return parts.join("");
    },
    "str/upper": async function* () {
      return ((yield 0) as string).toUpperCase();
    },
    "str/lower": async function* () {
      return ((yield 0) as string).toLowerCase();
    },
    "str/trim": async function* () {
      return ((yield 0) as string).trim();
    },
    "str/slice": async function* (entry) {
      const s = (yield 0) as string;
      const start = (yield 1) as number;
      // If there's a 3rd child, use it as end
      if (entry.children.length > 2) {
        const end = (yield 2) as number;
        return s.slice(start, end);
      }
      return s.slice(start);
    },
    "str/includes": async function* () {
      const haystack = (yield 0) as string;
      const needle = (yield 1) as string;
      return haystack.includes(needle);
    },
    "str/startsWith": async function* () {
      const s = (yield 0) as string;
      const prefix = (yield 1) as string;
      return s.startsWith(prefix);
    },
    "str/endsWith": async function* () {
      const s = (yield 0) as string;
      const suffix = (yield 1) as string;
      return s.endsWith(suffix);
    },
    "str/split": async function* () {
      const s = (yield 0) as string;
      const delimiter = (yield 1) as string;
      return s.split(delimiter);
    },
    "str/join": async function* () {
      const arr = (yield 0) as string[];
      const separator = (yield 1) as string;
      return arr.join(separator);
    },
    "str/replace": async function* () {
      const s = (yield 0) as string;
      const search = (yield 1) as string;
      const replacement = (yield 2) as string;
      return s.replace(search, replacement);
    },
    "str/len": async function* () {
      return ((yield 0) as string).length;
    },
    "str/eq": async function* () {
      return ((yield 0) as string) === ((yield 1) as string);
    },
    "str/show": async function* () {
      return yield 0;
    },
    "str/append": async function* () {
      return ((yield 0) as string) + ((yield 1) as string);
    },
    "str/mempty": async function* () {
      return "";
    },
  };
}
