import { isCExpr } from "@mvfm/core";

/**
 * Walk a descriptor object, extracting all CExpr references.
 * Returns serializable JSON (with { __ref: N } placeholders) and the extracted CExprs.
 *
 * Deduplicates CExpr objects: if the same CExpr instance appears multiple times
 * (e.g., identity transform where body === param), it gets the same __ref index.
 */
export function extractCExprs(descriptor: unknown): { serialized: string; refs: unknown[] } {
  const refs: unknown[] = [];
  const seen = new Map<unknown, number>();

  function extract(value: unknown): unknown {
    if (isCExpr(value)) {
      const existing = seen.get(value);
      if (existing !== undefined) {
        return { __ref: existing };
      }
      const idx = refs.length;
      refs.push(value);
      seen.set(value, idx);
      return { __ref: idx };
    }
    if (Array.isArray(value)) {
      return value.map(extract);
    }
    if (typeof value === "object" && value !== null) {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        result[k] = extract(v);
      }
      return result;
    }
    return value;
  }

  const cleaned = extract(descriptor);
  const serialized = JSON.stringify(cleaned);
  return { serialized, refs };
}
