import type { TypedNode } from "../../fold";
import { eval_, typedInterpreter } from "../../fold";

// ---- Typed node interfaces ----------------------------------

export interface StrTemplateNode extends TypedNode<string> {
  kind: "str/template";
  strings: string[];
  exprs: TypedNode[];
}

export interface StrConcatNode extends TypedNode<string> {
  kind: "str/concat";
  parts: TypedNode<string>[];
}

export interface StrUpperNode extends TypedNode<string> {
  kind: "str/upper";
  operand: TypedNode<string>;
}

export interface StrLowerNode extends TypedNode<string> {
  kind: "str/lower";
  operand: TypedNode<string>;
}

export interface StrTrimNode extends TypedNode<string> {
  kind: "str/trim";
  operand: TypedNode<string>;
}

export interface StrShowNode extends TypedNode<string> {
  kind: "str/show";
  operand: TypedNode<string>;
}

export interface StrLenNode extends TypedNode<number> {
  kind: "str/len";
  operand: TypedNode<string>;
}

export interface StrSliceNode extends TypedNode<string> {
  kind: "str/slice";
  operand: TypedNode<string>;
  start: TypedNode<number>;
  end?: TypedNode<number>;
}

export interface StrIncludesNode extends TypedNode<boolean> {
  kind: "str/includes";
  haystack: TypedNode<string>;
  needle: TypedNode<string>;
}

export interface StrStartsWithNode extends TypedNode<boolean> {
  kind: "str/startsWith";
  operand: TypedNode<string>;
  prefix: TypedNode<string>;
}

export interface StrEndsWithNode extends TypedNode<boolean> {
  kind: "str/endsWith";
  operand: TypedNode<string>;
  suffix: TypedNode<string>;
}

export interface StrSplitNode extends TypedNode<string[]> {
  kind: "str/split";
  operand: TypedNode<string>;
  delimiter: TypedNode<string>;
}

export interface StrJoinNode extends TypedNode<string> {
  kind: "str/join";
  array: TypedNode<string[]>;
  separator: TypedNode<string>;
}

export interface StrReplaceNode extends TypedNode<string> {
  kind: "str/replace";
  operand: TypedNode<string>;
  search: TypedNode<string>;
  replacement: TypedNode<string>;
}

export interface StrEqNode extends TypedNode<boolean> {
  kind: "str/eq";
  left: TypedNode<string>;
  right: TypedNode<string>;
}

export interface StrAppendNode extends TypedNode<string> {
  kind: "str/append";
  left: TypedNode<string>;
  right: TypedNode<string>;
}

export interface StrMemptyNode extends TypedNode<string> {
  kind: "str/mempty";
}

declare module "@mvfm/core" {
  interface NodeTypeMap {
    "str/template": StrTemplateNode;
    "str/concat": StrConcatNode;
    "str/upper": StrUpperNode;
    "str/lower": StrLowerNode;
    "str/trim": StrTrimNode;
    "str/slice": StrSliceNode;
    "str/includes": StrIncludesNode;
    "str/startsWith": StrStartsWithNode;
    "str/endsWith": StrEndsWithNode;
    "str/split": StrSplitNode;
    "str/join": StrJoinNode;
    "str/replace": StrReplaceNode;
    "str/len": StrLenNode;
    "str/eq": StrEqNode;
    "str/show": StrShowNode;
    "str/append": StrAppendNode;
    "str/mempty": StrMemptyNode;
  }
}

type StrKinds =
  | "str/template"
  | "str/concat"
  | "str/upper"
  | "str/lower"
  | "str/trim"
  | "str/slice"
  | "str/includes"
  | "str/startsWith"
  | "str/endsWith"
  | "str/split"
  | "str/join"
  | "str/replace"
  | "str/len"
  | "str/eq"
  | "str/show"
  | "str/append"
  | "str/mempty";

// ---- Interpreter map ----------------------------------------

/** Interpreter handlers for `str/` node kinds. */
export const strInterpreter = typedInterpreter<StrKinds>()({
  "str/template": async function* (node: StrTemplateNode) {
    let result = node.strings[0];
    for (let i = 0; i < node.exprs.length; i++) {
      result += String(yield* eval_(node.exprs[i]));
      result += node.strings[i + 1];
    }
    return result;
  },
  "str/concat": async function* (node: StrConcatNode) {
    const results: string[] = [];
    for (const p of node.parts) results.push(yield* eval_(p));
    return results.join("");
  },
  "str/upper": async function* (node: StrUpperNode) {
    return (yield* eval_(node.operand)).toUpperCase();
  },
  "str/lower": async function* (node: StrLowerNode) {
    return (yield* eval_(node.operand)).toLowerCase();
  },
  "str/trim": async function* (node: StrTrimNode) {
    return (yield* eval_(node.operand)).trim();
  },
  "str/slice": async function* (node: StrSliceNode) {
    const s = yield* eval_(node.operand);
    const start = yield* eval_(node.start);
    const end = node.end ? yield* eval_(node.end) : undefined;
    return s.slice(start, end);
  },
  "str/includes": async function* (node: StrIncludesNode) {
    const haystack = yield* eval_(node.haystack);
    return haystack.includes(yield* eval_(node.needle));
  },
  "str/startsWith": async function* (node: StrStartsWithNode) {
    return (yield* eval_(node.operand)).startsWith(yield* eval_(node.prefix));
  },
  "str/endsWith": async function* (node: StrEndsWithNode) {
    return (yield* eval_(node.operand)).endsWith(yield* eval_(node.suffix));
  },
  "str/split": async function* (node: StrSplitNode) {
    return (yield* eval_(node.operand)).split(yield* eval_(node.delimiter));
  },
  "str/join": async function* (node: StrJoinNode) {
    const arr = yield* eval_(node.array);
    return arr.join(yield* eval_(node.separator));
  },
  "str/replace": async function* (node: StrReplaceNode) {
    return (yield* eval_(node.operand)).replace(
      yield* eval_(node.search),
      yield* eval_(node.replacement),
    );
  },
  "str/len": async function* (node: StrLenNode) {
    return (yield* eval_(node.operand)).length;
  },
  "str/eq": async function* (node: StrEqNode) {
    return (yield* eval_(node.left)) === (yield* eval_(node.right));
  },
  "str/show": async function* (node: StrShowNode) {
    return yield* eval_(node.operand);
  },
  "str/append": async function* (node: StrAppendNode) {
    return (yield* eval_(node.left)) + (yield* eval_(node.right));
  },
  // biome-ignore lint/correctness/useYield: leaf handler
  "str/mempty": async function* (_node: StrMemptyNode) {
    return "";
  },
});
