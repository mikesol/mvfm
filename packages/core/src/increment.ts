/**
 * Increment — type-level and runtime ID generation
 *
 * Increment<S> computes the next base-26 ID at the type level.
 * incrementId(s) is the runtime mirror, producing identical results.
 * Used by normalize for sequential ID minting during DFS.
 */

// ─── IncrementLast: non-carry case (a->b, ..., y->z) ──────────────

/** Type-level non-carry increment of the last character (a->b, ..., y->z). */
export type IncrementLast<S extends string> = S extends `${infer R}a`
  ? `${R}b`
  : S extends `${infer R}b`
    ? `${R}c`
    : S extends `${infer R}c`
      ? `${R}d`
      : S extends `${infer R}d`
        ? `${R}e`
        : S extends `${infer R}e`
          ? `${R}f`
          : S extends `${infer R}f`
            ? `${R}g`
            : S extends `${infer R}g`
              ? `${R}h`
              : S extends `${infer R}h`
                ? `${R}i`
                : S extends `${infer R}i`
                  ? `${R}j`
                  : S extends `${infer R}j`
                    ? `${R}k`
                    : S extends `${infer R}k`
                      ? `${R}l`
                      : S extends `${infer R}l`
                        ? `${R}m`
                        : S extends `${infer R}m`
                          ? `${R}n`
                          : S extends `${infer R}n`
                            ? `${R}o`
                            : S extends `${infer R}o`
                              ? `${R}p`
                              : S extends `${infer R}p`
                                ? `${R}q`
                                : S extends `${infer R}q`
                                  ? `${R}r`
                                  : S extends `${infer R}r`
                                    ? `${R}s`
                                    : S extends `${infer R}s`
                                      ? `${R}t`
                                      : S extends `${infer R}t`
                                        ? `${R}u`
                                        : S extends `${infer R}u`
                                          ? `${R}v`
                                          : S extends `${infer R}v`
                                            ? `${R}w`
                                            : S extends `${infer R}w`
                                              ? `${R}x`
                                              : S extends `${infer R}x`
                                                ? `${R}y`
                                                : S extends `${infer R}y`
                                                  ? `${R}z`
                                                  : never;

// ─── Increment: full base-26 increment with carry ──────────────────

/** Type-level base-26 increment with carry propagation. "a"->"b", "z"->"aa", "az"->"ba", "zz"->"aaa". */
export type Increment<S extends string> = S extends `${infer Rest}z`
  ? Rest extends ""
    ? "aa"
    : `${Increment<Rest>}a`
  : IncrementLast<S>;

// ─── Runtime mirror ────────────────────────────────────────────────

/** Runtime base-26 increment matching the type-level Increment behavior. */
export function incrementId(s: string): string {
  if (s.length === 0) return "a";
  const last = s[s.length - 1];
  const rest = s.slice(0, -1);
  if (last === "z") {
    return rest === "" ? "aa" : `${incrementId(rest)}a`;
  }
  return rest + String.fromCharCode(last.charCodeAt(0) + 1);
}
