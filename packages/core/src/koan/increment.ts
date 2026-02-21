/**
 * Koan-model content-address increment function (01).
 */

/** Type-level non-carry increment for trailing char. */
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

/** Type-level full base-26 increment with carry. */
export type Increment<S extends string> = S extends `${infer Rest}z`
  ? Rest extends ""
    ? "aa"
    : `${Increment<Rest>}a`
  : IncrementLast<S>;

/**
 * Runtime mirror of base-26 increment used by koan IDs.
 * Examples: `a -> b`, `z -> aa`, `az -> ba`, `zz -> aaa`.
 */
export function incrementId(s: string): string {
  if (s.length === 0) {
    return "a";
  }
  const last = s[s.length - 1];
  const rest = s.slice(0, -1);
  if (last === "z") {
    return rest === "" ? "aa" : incrementId(rest) + "a";
  }
  return rest + String.fromCharCode(last.charCodeAt(0) + 1);
}
