import type { Program } from "./types";

/**
 * Inject input data into all `core/input` nodes in a Program.
 * Returns a new Program with the injected data — does not mutate the original.
 *
 * @param program - The Program to inject input into
 * @param input - Record mapping input field names to their runtime values
 * @returns A new Program with `__inputData` attached to all `core/input` nodes
 */
export function injectInput(program: Program, input: Record<string, unknown>): Program {
  function walk(node: any): any {
    if (node === null || node === undefined || typeof node !== "object") return node;
    if (Array.isArray(node)) return node.map((n) => walk(n));
    const result: any = {};
    for (const [k, v] of Object.entries(node)) {
      result[k] = walk(v);
    }
    if (result.kind === "core/input") result.__inputData = input;
    return result;
  }
  return { ...program, ast: walk(program.ast) };
}
