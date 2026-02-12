import type { ASTNode, InterpreterFragment } from "../../core";

export const strInterpreter: InterpreterFragment = {
  pluginName: "str",
  canHandle: (node) => node.kind.startsWith("str/"),
  visit(node: ASTNode, recurse: (node: ASTNode) => unknown): unknown {
    switch (node.kind) {
      case "str/template": {
        const strings = node.strings as string[];
        const exprs = node.exprs as ASTNode[];
        let result = strings[0];
        for (let i = 0; i < exprs.length; i++) {
          result += String(recurse(exprs[i]));
          result += strings[i + 1];
        }
        return result;
      }
      case "str/concat": {
        const parts = node.parts as ASTNode[];
        return parts.map((p) => recurse(p) as string).join("");
      }
      case "str/upper":
        return (recurse(node.operand as ASTNode) as string).toUpperCase();
      case "str/lower":
        return (recurse(node.operand as ASTNode) as string).toLowerCase();
      case "str/trim":
        return (recurse(node.operand as ASTNode) as string).trim();
      case "str/slice": {
        const s = recurse(node.operand as ASTNode) as string;
        const start = recurse(node.start as ASTNode) as number;
        const end = node.end ? (recurse(node.end as ASTNode) as number) : undefined;
        return s.slice(start, end);
      }
      case "str/includes":
        return (recurse(node.haystack as ASTNode) as string).includes(
          recurse(node.needle as ASTNode) as string,
        );
      case "str/startsWith":
        return (recurse(node.operand as ASTNode) as string).startsWith(
          recurse(node.prefix as ASTNode) as string,
        );
      case "str/endsWith":
        return (recurse(node.operand as ASTNode) as string).endsWith(
          recurse(node.suffix as ASTNode) as string,
        );
      case "str/split":
        return (recurse(node.operand as ASTNode) as string).split(
          recurse(node.delimiter as ASTNode) as string,
        );
      case "str/join":
        return (recurse(node.array as ASTNode) as string[]).join(
          recurse(node.separator as ASTNode) as string,
        );
      case "str/replace":
        return (recurse(node.operand as ASTNode) as string).replace(
          recurse(node.search as ASTNode) as string,
          recurse(node.replacement as ASTNode) as string,
        );
      case "str/len":
        return (recurse(node.operand as ASTNode) as string).length;
      case "str/eq":
        return recurse(node.left as ASTNode) === recurse(node.right as ASTNode);
      case "str/show":
        return recurse(node.operand as ASTNode) as string;
      case "str/append":
        return (
          (recurse(node.left as ASTNode) as string) + (recurse(node.right as ASTNode) as string)
        );
      case "str/mempty":
        return "";
      default:
        throw new Error(`Str interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
