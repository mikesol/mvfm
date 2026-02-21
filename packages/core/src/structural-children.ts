/**
 * Structural-children — utilities for walking structural node children.
 *
 * Structural nodes (e.g., geom/point, data/pair) store children[0] as
 * a Record<string, string> or string[] instead of flat strings. These
 * utilities let DAG operations (gc, commit, rewire, splice, wrap)
 * handle both flat and structural children uniformly.
 */

/** Extract all node-ID strings from a children value, recursing into Records and Arrays. */
export function extractChildIds(children: unknown): string[] {
  if (typeof children === "string") return [children];
  if (Array.isArray(children)) {
    const result: string[] = [];
    for (const item of children) {
      result.push(...extractChildIds(item));
    }
    return result;
  }
  if (typeof children === "object" && children !== null) {
    const result: string[] = [];
    for (const val of Object.values(children)) {
      result.push(...extractChildIds(val));
    }
    return result;
  }
  return [];
}

/** Recursively remap node-ID strings inside a structural children value. */
export function remapChildren(children: unknown, oldId: string, newId: string): unknown {
  if (typeof children === "string") {
    return children === oldId ? newId : children;
  }
  if (Array.isArray(children)) {
    return children.map((item) => remapChildren(item, oldId, newId));
  }
  if (typeof children === "object" && children !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(children)) {
      result[key] = remapChildren(val, oldId, newId);
    }
    return result;
  }
  return children;
}
