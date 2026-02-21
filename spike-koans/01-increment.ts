/**
 * Koan 01: Increment — type-level and runtime ID generation
 *
 * RULE: Never rewrite this file. Later koans import from here.
 *
 * What we prove:
 * - Increment<S> computes the next base-26 ID at the type level
 * - IncrementLast<S> handles the non-carry case (a→b, b→c, ..., y→z)
 * - Carry propagation works: "z" → "aa", "az" → "ba", "zz" → "aaa"
 * - incrementId(s) is the runtime mirror, producing identical results
 * - Type-level and runtime agree on all edge cases
 *
 * Used by: 03-normalize (sequential ID minting during DFS)
 *
 * Imports: 00-expr (re-exports everything)
 *
 * Gate:
 *   npx tsc --noEmit --strict spike-koans/01-increment.ts
 *   npx tsx spike-koans/01-increment.ts
 */

export * from "./00-expr";

// ─── IncrementLast: non-carry case (a→b, ..., y→z) ──────────────────
export type IncrementLast<S extends string> =
  S extends `${infer R}a` ? `${R}b` :
  S extends `${infer R}b` ? `${R}c` :
  S extends `${infer R}c` ? `${R}d` :
  S extends `${infer R}d` ? `${R}e` :
  S extends `${infer R}e` ? `${R}f` :
  S extends `${infer R}f` ? `${R}g` :
  S extends `${infer R}g` ? `${R}h` :
  S extends `${infer R}h` ? `${R}i` :
  S extends `${infer R}i` ? `${R}j` :
  S extends `${infer R}j` ? `${R}k` :
  S extends `${infer R}k` ? `${R}l` :
  S extends `${infer R}l` ? `${R}m` :
  S extends `${infer R}m` ? `${R}n` :
  S extends `${infer R}n` ? `${R}o` :
  S extends `${infer R}o` ? `${R}p` :
  S extends `${infer R}p` ? `${R}q` :
  S extends `${infer R}q` ? `${R}r` :
  S extends `${infer R}r` ? `${R}s` :
  S extends `${infer R}s` ? `${R}t` :
  S extends `${infer R}t` ? `${R}u` :
  S extends `${infer R}u` ? `${R}v` :
  S extends `${infer R}v` ? `${R}w` :
  S extends `${infer R}w` ? `${R}x` :
  S extends `${infer R}x` ? `${R}y` :
  S extends `${infer R}y` ? `${R}z` :
  never;

// ─── Increment: full base-26 increment with carry ────────────────────
// "a" → "b", "z" → "aa", "az" → "ba", "zz" → "aaa"
export type Increment<S extends string> =
  S extends `${infer Rest}z`
    ? Rest extends ""
      ? "aa"
      : `${Increment<Rest>}a`
    : IncrementLast<S>;

// ─── Runtime mirror ──────────────────────────────────────────────────
export function incrementId(s: string): string {
  if (s.length === 0) return "a";
  const last = s[s.length - 1];
  const rest = s.slice(0, -1);
  if (last === "z") {
    return rest === "" ? "aa" : incrementId(rest) + "a";
  }
  return rest + String.fromCharCode(last.charCodeAt(0) + 1);
}

// ═══════════════════════════════════════════════════════════════════════
// COMPILE-TIME TESTS
// ═══════════════════════════════════════════════════════════════════════

// --- Non-carry: single char ---
const _a2b: Increment<"a"> = "b";
const _b2c: Increment<"b"> = "c";
const _m2n: Increment<"m"> = "n";
const _y2z: Increment<"y"> = "z";

// @ts-expect-error — "a" does not increment to "a"
const _a2a: Increment<"a"> = "a";
// @ts-expect-error — "a" does not increment to "c"
const _a2c: Increment<"a"> = "c";

// --- Carry: single z ---
const _z2aa: Increment<"z"> = "aa";
// @ts-expect-error — "z" does not increment to "ba"
const _z2ba: Increment<"z"> = "ba";

// --- Carry: trailing z with prefix ---
const _az2ba: Increment<"az"> = "ba";
const _bz2ca: Increment<"bz"> = "ca";
const _yz2za: Increment<"yz"> = "za";

// @ts-expect-error — "az" does not increment to "aa"
const _az2aa: Increment<"az"> = "aa";

// --- Multi-char carry ---
const _zz2aaa: Increment<"zz"> = "aaa";
const _zzz2aaaa: Increment<"zzz"> = "aaaa";

// --- Non-carry multi-char ---
const _aa2ab: Increment<"aa"> = "ab";
const _ab2ac: Increment<"ab"> = "ac";
const _ay2az: Increment<"ay"> = "az";

// --- Chained increments ---
type After_a = Increment<"a">;           // "b"
type After_b = Increment<After_a>;       // "c"
type After_c = Increment<After_b>;       // "d"
const _chain_b: After_a = "b";
const _chain_c: After_b = "c";
const _chain_d: After_c = "d";

// --- Mixed carry chain ---
type After_y = Increment<"y">;           // "z"
type After_z = Increment<After_y>;       // "aa"
type After_aa = Increment<After_z>;      // "ab"
const _chain_z: After_y = "z";
const _chain_aa: After_z = "aa";
const _chain_ab: After_aa = "ab";

// ═══════════════════════════════════════════════════════════════════════
// RUNTIME TESTS — type-level and runtime must agree
// ═══════════════════════════════════════════════════════════════════════

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${msg}`);
  }
}

// Non-carry
assert(incrementId("a") === "b", "a → b");
assert(incrementId("b") === "c", "b → c");
assert(incrementId("m") === "n", "m → n");
assert(incrementId("y") === "z", "y → z");

// Single carry
assert(incrementId("z") === "aa", "z → aa");

// Carry with prefix
assert(incrementId("az") === "ba", "az → ba");
assert(incrementId("bz") === "ca", "bz → ca");
assert(incrementId("yz") === "za", "yz → za");

// Multi carry
assert(incrementId("zz") === "aaa", "zz → aaa");
assert(incrementId("zzz") === "aaaa", "zzz → aaaa");

// Non-carry multi-char
assert(incrementId("aa") === "ab", "aa → ab");
assert(incrementId("ab") === "ac", "ab → ac");
assert(incrementId("ay") === "az", "ay → az");

// Chain from a through several
let id = "a";
const expected = ["b", "c", "d", "e", "f", "g", "h", "i", "j", "k",
  "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x",
  "y", "z", "aa", "ab", "ac"];
for (const exp of expected) {
  id = incrementId(id);
  assert(id === exp, `chain: → ${exp}`);
}

console.log(`\n01-increment: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
