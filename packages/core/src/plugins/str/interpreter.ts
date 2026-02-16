import type { Interpreter, TypedNode } from "../../fold";
import { eval_ } from "../../fold";

// ---- Typed node interfaces ----------------------------------

interface StrTemplate extends TypedNode<string> {
  kind: "str/template";
  strings: string[];
  exprs: TypedNode[];
}

interface StrConcat extends TypedNode<string> {
  kind: "str/concat";
  parts: TypedNode<string>[];
}

interface StrUnary extends TypedNode<string> {
  operand: TypedNode<string>;
}

interface StrSlice extends TypedNode<string> {
  kind: "str/slice";
  operand: TypedNode<string>;
  start: TypedNode<number>;
  end?: TypedNode<number>;
}

interface StrIncludes extends TypedNode<boolean> {
  kind: "str/includes";
  haystack: TypedNode<string>;
  needle: TypedNode<string>;
}

interface StrPrefixSuffix extends TypedNode<boolean> {
  operand: TypedNode<string>;
  prefix?: TypedNode<string>;
  suffix?: TypedNode<string>;
}

interface StrSplit extends TypedNode<string[]> {
  kind: "str/split";
  operand: TypedNode<string>;
  delimiter: TypedNode<string>;
}

interface StrJoin extends TypedNode<string> {
  kind: "str/join";
  array: TypedNode<string[]>;
  separator: TypedNode<string>;
}

interface StrReplace extends TypedNode<string> {
  kind: "str/replace";
  operand: TypedNode<string>;
  search: TypedNode<string>;
  replacement: TypedNode<string>;
}

interface StrBinOp extends TypedNode<string> {
  left: TypedNode<string>;
  right: TypedNode<string>;
}

// ---- Interpreter map ----------------------------------------

/** Interpreter handlers for `str/` node kinds. */
export const strInterpreter: Interpreter = {
  "str/template": async function* (node: StrTemplate) {
    let result = node.strings[0];
    for (let i = 0; i < node.exprs.length; i++) {
      result += String(yield* eval_(node.exprs[i]));
      result += node.strings[i + 1];
    }
    return result;
  },
  "str/concat": async function* (node: StrConcat) {
    const results: string[] = [];
    for (const p of node.parts) results.push(yield* eval_(p));
    return results.join("");
  },
  "str/upper": async function* (node: StrUnary) {
    return (yield* eval_(node.operand)).toUpperCase();
  },
  "str/lower": async function* (node: StrUnary) {
    return (yield* eval_(node.operand)).toLowerCase();
  },
  "str/trim": async function* (node: StrUnary) {
    return (yield* eval_(node.operand)).trim();
  },
  "str/slice": async function* (node: StrSlice) {
    const s = yield* eval_(node.operand);
    const start = yield* eval_(node.start);
    const end = node.end ? yield* eval_(node.end) : undefined;
    return s.slice(start, end);
  },
  "str/includes": async function* (node: StrIncludes) {
    const haystack = yield* eval_(node.haystack);
    return haystack.includes(yield* eval_(node.needle));
  },
  "str/startsWith": async function* (node: StrPrefixSuffix) {
    return (yield* eval_(node.operand)).startsWith(yield* eval_(node.prefix!));
  },
  "str/endsWith": async function* (node: StrPrefixSuffix) {
    return (yield* eval_(node.operand)).endsWith(yield* eval_(node.suffix!));
  },
  "str/split": async function* (node: StrSplit) {
    return (yield* eval_(node.operand)).split(yield* eval_(node.delimiter));
  },
  "str/join": async function* (node: StrJoin) {
    const arr = yield* eval_(node.array);
    return arr.join(yield* eval_(node.separator));
  },
  "str/replace": async function* (node: StrReplace) {
    return (yield* eval_(node.operand)).replace(
      yield* eval_(node.search),
      yield* eval_(node.replacement),
    );
  },
  "str/len": async function* (node: StrUnary) {
    return (yield* eval_(node.operand)).length;
  },
  "str/eq": async function* (node: StrBinOp) {
    return (yield* eval_(node.left)) === (yield* eval_(node.right));
  },
  "str/show": async function* (node: StrUnary) {
    return yield* eval_(node.operand);
  },
  "str/append": async function* (node: StrBinOp) {
    return (yield* eval_(node.left)) + (yield* eval_(node.right));
  },
  // biome-ignore lint/correctness/useYield: leaf handler
  "str/mempty": async function* () {
    return "";
  },
};
