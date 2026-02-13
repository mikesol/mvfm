import type { ASTNode, InterpreterFragment, StepEffect } from "../../core";

/** Interpreter fragment for `str/` node kinds. */
export const strInterpreter: InterpreterFragment = {
  pluginName: "str",
  canHandle: (node) => node.kind.startsWith("str/"),
  *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
    switch (node.kind) {
      case "str/template": {
        const strings = node.strings as string[];
        const exprs = node.exprs as ASTNode[];
        let result = strings[0];
        for (let i = 0; i < exprs.length; i++) {
          result += String(yield { type: "recurse", child: exprs[i] });
          result += strings[i + 1];
        }
        return result;
      }
      case "str/concat": {
        const parts = node.parts as ASTNode[];
        const results: string[] = [];
        for (const p of parts) {
          results.push((yield { type: "recurse", child: p }) as string);
        }
        return results.join("");
      }
      case "str/upper":
        return (
          (yield { type: "recurse", child: node.operand as ASTNode }) as string
        ).toUpperCase();
      case "str/lower":
        return (
          (yield { type: "recurse", child: node.operand as ASTNode }) as string
        ).toLowerCase();
      case "str/trim":
        return ((yield { type: "recurse", child: node.operand as ASTNode }) as string).trim();
      case "str/slice": {
        const s = (yield { type: "recurse", child: node.operand as ASTNode }) as string;
        const start = (yield { type: "recurse", child: node.start as ASTNode }) as number;
        const end = node.end
          ? ((yield { type: "recurse", child: node.end as ASTNode }) as number)
          : undefined;
        return s.slice(start, end);
      }
      case "str/includes":
        return ((yield { type: "recurse", child: node.haystack as ASTNode }) as string).includes(
          (yield { type: "recurse", child: node.needle as ASTNode }) as string,
        );
      case "str/startsWith":
        return ((yield { type: "recurse", child: node.operand as ASTNode }) as string).startsWith(
          (yield { type: "recurse", child: node.prefix as ASTNode }) as string,
        );
      case "str/endsWith":
        return ((yield { type: "recurse", child: node.operand as ASTNode }) as string).endsWith(
          (yield { type: "recurse", child: node.suffix as ASTNode }) as string,
        );
      case "str/split":
        return ((yield { type: "recurse", child: node.operand as ASTNode }) as string).split(
          (yield { type: "recurse", child: node.delimiter as ASTNode }) as string,
        );
      case "str/join":
        return ((yield { type: "recurse", child: node.array as ASTNode }) as string[]).join(
          (yield { type: "recurse", child: node.separator as ASTNode }) as string,
        );
      case "str/replace":
        return ((yield { type: "recurse", child: node.operand as ASTNode }) as string).replace(
          (yield { type: "recurse", child: node.search as ASTNode }) as string,
          (yield { type: "recurse", child: node.replacement as ASTNode }) as string,
        );
      case "str/len":
        return ((yield { type: "recurse", child: node.operand as ASTNode }) as string).length;
      case "str/eq":
        return (
          (yield { type: "recurse", child: node.left as ASTNode }) ===
          (yield { type: "recurse", child: node.right as ASTNode })
        );
      case "str/show":
        return (yield { type: "recurse", child: node.operand as ASTNode }) as string;
      case "str/append":
        return (
          ((yield { type: "recurse", child: node.left as ASTNode }) as string) +
          ((yield { type: "recurse", child: node.right as ASTNode }) as string)
        );
      case "str/mempty":
        return "";
      default:
        throw new Error(`Str interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
