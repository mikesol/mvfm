import type { Interpreter, TypedNode } from "./fold";
import type { Program } from "./types";

/** Walk an AST to verify all node kinds have handlers. Throws if any are missing. */
export function checkCompleteness(interpreter: Interpreter, program: Program): void;
export function checkCompleteness(interpreter: Interpreter, root: TypedNode): void;
export function checkCompleteness(
  interpreter: Interpreter,
  rootOrProgram: TypedNode | Program,
): void {
  const root =
    "ast" in rootOrProgram && "hash" in rootOrProgram
      ? (rootOrProgram as Program).ast.result
      : (rootOrProgram as TypedNode);
  const visited = new WeakSet<TypedNode>();
  const missing = new Set<string>();
  const queue: TypedNode[] = [root];

  while (queue.length > 0) {
    const node = queue.pop()!;
    if (visited.has(node)) continue;
    visited.add(node);

    if (!interpreter[node.kind]) missing.add(node.kind);

    for (const val of Object.values(node)) {
      if (val && typeof val === "object" && "kind" in val) {
        queue.push(val as TypedNode);
      }
      if (Array.isArray(val)) {
        for (const v of val) {
          if (v && typeof v === "object" && "kind" in v) {
            queue.push(v as TypedNode);
          }
        }
      }
    }
  }

  if (missing.size > 0) {
    throw new Error(`Missing interpreters for: ${[...missing].join(", ")}`);
  }
}
