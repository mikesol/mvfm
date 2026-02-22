/**
 * Recording stack — imperative block capture for mvfm().
 *
 * Provides utilities to capture CExpr side effects produced
 * during callback execution (e.g., $.each, $.while, $.cond).
 */

import type { CExpr } from "./expr";
import { isCExpr, makeCExpr } from "./expr";

// ─── Recording stack for imperative block capture ───────────────────

export type RecordingStack = unknown[][];

export function startRecording(stack: RecordingStack): void {
  stack.push([]);
}

export function stopRecording(stack: RecordingStack): unknown[] {
  return stack.pop() ?? [];
}

/** Check if a CExpr appears as a (transitive) argument to another CExpr. */
function isConsumedBy(needle: unknown, haystack: unknown, depth = 0): boolean {
  if (depth > 20) return false;
  if (!isCExpr(haystack)) return false;
  const args = (haystack as CExpr<unknown>).__args;
  for (const arg of args) {
    if (arg === needle) return true;
    if (isCExpr(arg) && isConsumedBy(needle, arg, depth + 1)) return true;
    if (Array.isArray(arg)) {
      for (const item of arg) {
        if (item === needle) return true;
        if (isCExpr(item) && isConsumedBy(needle, item, depth + 1)) return true;
      }
    }
    if (typeof arg === "object" && arg !== null && !isCExpr(arg) && !Array.isArray(arg)) {
      for (const v of Object.values(arg as Record<string, unknown>)) {
        if (v === needle) return true;
        if (isCExpr(v) && isConsumedBy(needle, v, depth + 1)) return true;
      }
    }
  }
  return false;
}

/** Run a callback inside a recording context, return result or collected exprs. */
export function runBlock(
  stack: RecordingStack,
  fn: (...args: unknown[]) => unknown,
  args: unknown[],
): unknown {
  startRecording(stack);
  const result = fn(...args);
  const recorded = stopRecording(stack);

  const all = [...recorded];
  if (result !== undefined && isCExpr(result) && !all.includes(result)) {
    all.push(result);
  }

  const roots = all.filter((expr) => {
    for (const other of all) {
      if (other !== expr && isConsumedBy(expr, other)) return false;
    }
    return true;
  });

  if (roots.length === 0) return makeCExpr("core/begin", []);
  if (roots.length === 1) return roots[0];
  return makeCExpr("core/begin", roots);
}
