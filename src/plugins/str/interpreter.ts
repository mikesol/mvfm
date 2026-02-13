import type { ASTNode, InterpreterFragment } from "../../core";

export const strInterpreter: InterpreterFragment = {
  pluginName: "str",
  canHandle: (node) => node.kind.startsWith("str/"),
  async visit(node: ASTNode, recurse: (node: ASTNode) => Promise<unknown>): Promise<unknown> {
    switch (node.kind) {
      case "str/template": {
        const strings = node.strings as string[];
        const exprs = node.exprs as ASTNode[];
        let result = strings[0];
        for (let i = 0; i < exprs.length; i++) {
          result += String(await recurse(exprs[i]));
          result += strings[i + 1];
        }
        return result;
      }
      case "str/concat": {
        const parts = node.parts as ASTNode[];
        const results = await Promise.all(parts.map((p) => recurse(p)));
        return (results as string[]).join("");
      }
      case "str/upper":
        return ((await recurse(node.operand as ASTNode)) as string).toUpperCase();
      case "str/lower":
        return ((await recurse(node.operand as ASTNode)) as string).toLowerCase();
      case "str/trim":
        return ((await recurse(node.operand as ASTNode)) as string).trim();
      case "str/slice": {
        const s = (await recurse(node.operand as ASTNode)) as string;
        const start = (await recurse(node.start as ASTNode)) as number;
        const end = node.end ? ((await recurse(node.end as ASTNode)) as number) : undefined;
        return s.slice(start, end);
      }
      case "str/includes":
        return ((await recurse(node.haystack as ASTNode)) as string).includes(
          (await recurse(node.needle as ASTNode)) as string,
        );
      case "str/startsWith":
        return ((await recurse(node.operand as ASTNode)) as string).startsWith(
          (await recurse(node.prefix as ASTNode)) as string,
        );
      case "str/endsWith":
        return ((await recurse(node.operand as ASTNode)) as string).endsWith(
          (await recurse(node.suffix as ASTNode)) as string,
        );
      case "str/split":
        return ((await recurse(node.operand as ASTNode)) as string).split(
          (await recurse(node.delimiter as ASTNode)) as string,
        );
      case "str/join":
        return ((await recurse(node.array as ASTNode)) as string[]).join(
          (await recurse(node.separator as ASTNode)) as string,
        );
      case "str/replace":
        return ((await recurse(node.operand as ASTNode)) as string).replace(
          (await recurse(node.search as ASTNode)) as string,
          (await recurse(node.replacement as ASTNode)) as string,
        );
      case "str/len":
        return ((await recurse(node.operand as ASTNode)) as string).length;
      case "str/eq":
        return (await recurse(node.left as ASTNode)) === (await recurse(node.right as ASTNode));
      case "str/show":
        return (await recurse(node.operand as ASTNode)) as string;
      case "str/append":
        return (
          ((await recurse(node.left as ASTNode)) as string) +
          ((await recurse(node.right as ASTNode)) as string)
        );
      case "str/mempty":
        return "";
      default:
        throw new Error(`Str interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
