# Ctor-Kind Consistency Enforcement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enforce at the Plugin type level that every CExpr kind produced by a plugin's constructors is declared in its `kinds` map, then refactor all 14 external plugins to use the permissive constructor pattern.

**Architecture:** Add `ExtractKinds<T>` recursive type and `NonCoreKinds<T>` filter to `plugin.ts`. Change `Plugin.ctors` to a conditional type that collapses to `never` when ctor kinds aren't in `kinds`. Then mechanically refactor each external plugin: make ctors permissive (generic params, kind strings in return types), inline kinds as const, delete hand-written method interfaces.

**Tech Stack:** TypeScript type-level programming, vitest for tests.

---

### Task 1: Add ExtractKinds and enforce on Plugin type

**Files:**
- Modify: `packages/core/src/plugin.ts`

**Step 1: Write a type-level test that proves the constraint works**

Create `packages/core/tests/extract-kinds.test.ts`:

```typescript
/**
 * Type-level tests for ExtractKinds / Plugin ctor-kind enforcement.
 */
import { describe, it } from "vitest";
import type { CExpr } from "../src/expr";
import type { KindSpec } from "../src/registry";
import type { Plugin } from "../src/plugin";

// ─── Test: well-formed plugin compiles ──────────────────────────

describe("ExtractKinds enforcement", () => {
  it("plugin with matching ctors and kinds compiles", () => {
    const good = {
      name: "test" as const,
      ctors: {
        add: <A, B>(a: A, b: B): CExpr<number, "test/add", [A, B]> =>
          null! as CExpr<number, "test/add", [A, B]>,
      },
      kinds: {
        "test/add": {
          inputs: [0, 0] as [number, number],
          output: 0 as number,
        } as KindSpec<[number, number], number>,
      },
      traits: {},
      lifts: {},
    } satisfies Plugin;
    void good;
  });

  it("plugin with unregistered kind fails to compile", () => {
    const bad = {
      name: "test" as const,
      ctors: {
        add: <A, B>(a: A, b: B): CExpr<number, "test/add", [A, B]> =>
          null! as CExpr<number, "test/add", [A, B]>,
        sub: <A, B>(a: A, b: B): CExpr<number, "test/sub", [A, B]> =>
          null! as CExpr<number, "test/sub", [A, B]>,
      },
      kinds: {
        "test/add": {
          inputs: [0, 0] as [number, number],
          output: 0 as number,
        } as KindSpec<[number, number], number>,
        // test/sub NOT registered
      },
      traits: {},
      lifts: {},
    };
    // @ts-expect-error — ctors collapse to never because test/sub not in kinds
    const _check: Plugin = bad;
    void _check;
  });

  it("plugin producing core/* kinds compiles without declaring them", () => {
    const coreRef = {
      name: "myplug" as const,
      ctors: {
        each: (items: unknown[], fn: (i: unknown) => unknown) => {
          return null! as CExpr<unknown, "core/begin", unknown[]>;
        },
        loop: (cond: unknown) => ({
          body: (fn: () => unknown) =>
            null! as CExpr<unknown, "myplug/while", [unknown, unknown]>,
        }),
      },
      kinds: {
        "myplug/while": {
          inputs: [] as unknown[],
          output: undefined as unknown,
        } as KindSpec<unknown[], unknown>,
      },
      traits: {},
      lifts: {},
    } satisfies Plugin;
    void coreRef;
  });

  it("nested ctor objects work with ExtractKinds", () => {
    const nested = {
      name: "ns" as const,
      ctors: {
        ns: {
          get: <A>(key: A): CExpr<string | null, "ns/get", [A]> =>
            null! as CExpr<string | null, "ns/get", [A]>,
          set: <A, B>(key: A, val: B): CExpr<string, "ns/set", [A, B]> =>
            null! as CExpr<string, "ns/set", [A, B]>,
        },
      },
      kinds: {
        "ns/get": {
          inputs: [""] as [string],
          output: null as string | null,
        } as KindSpec<[string], string | null>,
        "ns/set": {
          inputs: ["", ""] as [string, string],
          output: "" as string,
        } as KindSpec<[string, string], string>,
      },
      traits: {},
      lifts: {},
    } satisfies Plugin;
    void nested;
  });
});
```

**Step 2: Run the test — it should fail (Plugin doesn't enforce yet)**

Run: `cd packages/core && npx vitest run tests/extract-kinds.test.ts`
Expected: The `@ts-expect-error` test fails because Plugin currently accepts anything.

**Step 3: Add ExtractKinds and modify Plugin interface**

In `packages/core/src/plugin.ts`, add before the Plugin interface:

```typescript
// ─── ExtractKinds: collect CExpr kinds from ctor types ──────────

/** Recursively walks a type and collects all CExpr kind strings it produces. */
export type ExtractKinds<T> =
  T extends CExpr<any, infer K extends string, any>
    ? K
    : T extends (...args: any[]) => infer R
      ? ExtractKinds<R>
      : T extends Record<string, unknown>
        ? { [P in keyof T]: ExtractKinds<T[P]> }[keyof T]
        : never;

/** Filters out core/* kinds — core is universal infrastructure any plugin can reference. */
type NonCoreKinds<K> = K extends `core/${string}` ? never : K;

/** Validates that all non-core kinds produced by Ctors are declared in Kinds. */
type ValidateCtors<Ctors, Kinds> =
  [NonCoreKinds<ExtractKinds<Ctors>>] extends [keyof Kinds] ? Ctors : never;
```

Then change the Plugin interface:

```typescript
export interface Plugin<
  Name extends string = string,
  Ctors = any,
  Kinds extends Record<string, KindSpec<any, any>> = any,
  Traits extends Record<string, TraitDef<any, any>> = any,
  Lifts extends Record<string, string> = any,
> {
  readonly name: Name;
  readonly ctors: ValidateCtors<Ctors, Kinds>;
  readonly kinds: Kinds;
  readonly traits: Traits;
  readonly lifts: Lifts;
  readonly defaultInterpreter?: () => Interpreter;
  readonly shapes?: Record<string, unknown>;
}
```

Note: Ctors parameter relaxed from `Record<string, (...args: any[]) => any>` to bare `any`.

**Step 4: Run the type test again**

Run: `cd packages/core && npx vitest run tests/extract-kinds.test.ts`
Expected: All 4 tests pass. The `@ts-expect-error` correctly triggers.

**Step 5: Run the full core build to see what breaks**

Run: `cd packages/core && npx tsc --noEmit`
Expected: Type errors in plugins where ctors return CExpr without kind strings (external plugins). Core plugins (numPlugin, strPlugin, etc.) should still compile because their ctors already use the permissive pattern with kind strings.

**Step 6: Fix MergeCtors if needed**

`MergeCtors<P>` currently uses `H["ctors"]` to access ctor types. With the conditional `ctors` field, this still resolves correctly for well-formed plugins. Verify by checking that `mvfmU()` still compiles.

**Step 7: Commit**

```bash
git add packages/core/src/plugin.ts packages/core/tests/extract-kinds.test.ts
git commit -m "feat(core): enforce ctor-kind consistency at Plugin type level (#300)"
```

---

### Task 2: Verify core plugins still compile

**Files:**
- Check: `packages/core/src/core-plugin.ts`
- Check: `packages/core/src/std-plugins.ts`
- Check: `packages/core/src/std-plugins-str.ts`
- Check: `packages/core/src/std-plugins-bool.ts`
- Check: `packages/core/src/std-plugins-ord.ts`
- Check: `packages/core/src/error.ts`
- Check: `packages/core/src/control.ts`
- Check: `packages/core/src/fiber.ts`

**Step 1: Run core type check**

Run: `cd packages/core && npx tsc --noEmit 2>&1 | head -80`

Examine output. Core plugins should compile because:
- `numPlugin`: ctors use `add<A,B>(...): CExpr<number, "num/add", [A,B]>` — kind visible
- `strPlugin`: same pattern
- `boolPlugin`: same pattern
- `ordPlugin`: has `lt` which produces... need to verify
- `corePlugin`: ctors is `{}` — no kinds extracted, vacuously true
- `error`: ctors produce `error/try`, `error/fail` etc. — need to verify kind strings visible
- `control.each`: produces `core/begin` — filtered by NonCoreKinds, OK
- `control.while`: builder returns `control/while` — in kinds, OK
- `fiber.par`: tuple form produces `core/tuple` — filtered, OK. Map form produces `fiber/par_map` — in kinds, OK

**Step 2: Fix any core plugin issues**

If any core plugin fails, the fix is to ensure kind strings are explicit in return types. For example, if `error.try` returns an inferred type that hides the kind string, add an explicit return type annotation.

Potential issue: `error.try` returns `{ catch: (fn) => ... }` where the catch function returns `makeCExpr("error/try", ...)`. TypeScript may infer the kind string from `makeCExpr`'s return type. Verify.

**Step 3: Run full core test suite**

Run: `cd packages/core && npx vitest run`
Expected: All tests pass. No runtime changes.

**Step 4: Commit any fixes**

```bash
git add -A && git commit -m "fix(core): ensure core plugin ctors have visible kind strings (#300)"
```

---

### Task 3: Refactor plugin-redis

This is the template for all external plugins. Do it carefully — the pattern established here will be replicated.

**Files:**
- Modify: `packages/plugin-redis/src/5.4.1/index.ts` (inline kinds)
- Modify: `packages/plugin-redis/src/5.4.1/build-methods.ts` (permissive ctors)
- Modify: `packages/plugin-redis/src/5.4.1/types.ts` (delete RedisMethods or simplify)

**Step 1: Run current redis build to establish baseline**

Run: `cd packages/plugin-redis && npx tsc --noEmit`
Expected: Fails because `buildKinds()` erases types with `Record<string, KindSpec<any, any>>`.

**Step 2: Inline kinds in index.ts**

Replace the `buildKinds()` call with inline kinds. The values are already precise — it's just the function return type that erases them. Move the kinds object literal directly into the plugin return value.

**Step 3: Make build-methods.ts ctors permissive**

Change each method from:
```typescript
get(key: CExpr<string> | string): CExpr<string | null>
```
to:
```typescript
get<A>(key: A): CExpr<string | null, "redis/get", [A]>
```

The method body stays the same (`makeCExpr("redis/get", [liftArg(key)])`). Only the type signature changes.

For variadic methods like `mget(...keys)`, use:
```typescript
mget<A extends readonly unknown[]>(...keys: A): CExpr<(string | null)[], "redis/mget", A>
```

For methods with optional params like `lpop(key, count?)`, handle the union:
```typescript
lpop<A>(key: A, count?: unknown): CExpr<string | null | string[], "redis/lpop", [A, ...unknown[]]>
```

**Step 4: Update or delete types.ts**

The `RedisMethods` interface is no longer needed as the source of truth for ctor types — the function signatures in build-methods.ts are the types. Either:
- Delete `RedisMethods` entirely and remove the `as RedisMethods["redis"]` cast from `buildRedisApi()`
- Or keep it as documentation but derive it from the actual function signatures

Preference: delete it. The function signatures are the types.

Also add `redis/record` and `redis/array` to the kinds map (they're produced by `liftArg`).

**Step 5: Verify compilation**

Run: `cd packages/plugin-redis && npx tsc --noEmit`
Expected: Compiles cleanly.

**Step 6: Run redis tests**

Run: `cd packages/plugin-redis && npx vitest run`
Expected: All tests pass (runtime unchanged).

**Step 7: Commit**

```bash
git add packages/plugin-redis/
git commit -m "refactor(redis): permissive ctors + inline kinds for ctor-kind enforcement (#300)"
```

---

### Task 4: Refactor plugin-openai

**Files:**
- Modify: `packages/plugin-openai/src/6.21.0/index.ts`

Same pattern as redis:
1. Inline `buildKinds()` → `kinds: { ... } as const`
2. Make `buildOpenAIApi()` return permissive ctors with kind strings in return types
3. Delete or simplify any hand-written method interface types
4. Verify: `cd packages/plugin-openai && npx tsc --noEmit && npx vitest run`
5. Commit

---

### Task 5: Refactor plugin-anthropic

**Files:**
- Modify: `packages/plugin-anthropic/src/0.74.0/index.ts`

Same pattern. Verify + commit.

---

### Task 6: Refactor plugin-stripe

**Files:**
- Modify: `packages/plugin-stripe/src/2025-04-30.basil/index.ts`

Same pattern. Verify + commit.

---

### Task 7: Refactor plugin-postgres

**Files:**
- Modify: `packages/plugin-postgres/src/3.4.8/index.ts`

Special care: postgres uses tagged template literals (`sql\`...\``) and scope-dependent methods. The tagged template ctor produces `postgres/query` nodes. Ensure the template literal function has a return type with the kind string visible.

Same pattern otherwise. Verify + commit.

---

### Task 8: Refactor plugin-fetch

**Files:**
- Modify: `packages/plugin-fetch/src/whatwg/index.ts`

Special care: fetch uses a callable builder (`fetch(url)` returns an object with `.json()`, `.text()` etc.). Each method on the returned object produces a different kind. ExtractKinds handles this via the `Record<string, unknown>` branch walking the returned object.

Same pattern. Verify + commit.

---

### Task 9: Refactor plugin-s3

**Files:**
- Modify: `packages/plugin-s3/src/3.989.0/index.ts`

Same pattern. Verify + commit.

---

### Task 10: Refactor plugin-resend

**Files:**
- Modify: `packages/plugin-resend/src/6.9.2/index.ts`

Same pattern. Verify + commit.

---

### Task 11: Refactor plugin-cloudflare-kv

**Files:**
- Modify: `packages/plugin-cloudflare-kv/src/4.20260213.0/index.ts`

Same pattern. Verify + commit.

---

### Task 12: Refactor plugin-console

**Files:**
- Modify: `packages/plugin-console/src/22.0.0/index.ts`

Special care: console has 20 methods generated from METHOD_NAMES array. The method factory needs to produce return types with kind strings. May need to change the generation loop.

Same pattern. Verify + commit.

---

### Task 13: Refactor plugin-pino

**Files:**
- Modify: `packages/plugin-pino/src/10.3.1/index.ts`

Special care: pino has recursive child logger builders. The logger methods are overloaded (1 or 2 args). Ensure all overloads have kind strings in return types.

Same pattern. Verify + commit.

---

### Task 14: Refactor plugin-fal

**Files:**
- Modify: `packages/plugin-fal/src/1.9.1/index.ts`

Same pattern. Verify + commit.

---

### Task 15: Refactor plugin-slack

**Files:**
- Modify: `packages/plugin-slack/src/7.14.0/index.ts`
- May need to modify generated build-methods

Special care: slack is code-generated. The generated methods need to produce CExpr types with kind strings. This may require modifying the code generator or the generated output.

Same pattern. Verify + commit.

---

### Task 16: Refactor plugin-twilio

**Files:**
- Modify: `packages/plugin-twilio/src/5.5.1/index.ts`

Special care: twilio uses callable builders (`messages(sid)` → `{ fetch() }`). Object.assign pattern. Ensure kind strings flow through.

Same pattern. Verify + commit.

---

### Task 17: Refactor plugin-zod

**Files:**
- Modify: `packages/plugin-zod/src/index.ts`
- May need to modify `packages/plugin-zod/src/base-core.ts`, `base.ts`, etc.

Special care: zod uses `core/lambda_param` (filtered by NonCoreKinds). The 23 namespace builders spread into a single object. Each namespace's parse/safeParse methods need kind strings in return types.

Same pattern. Verify + commit.

---

### Task 18: Full verification

**Step 1: Run full monorepo build**

Run: `npm run build`
Expected: All packages compile.

**Step 2: Run full monorepo check**

Run: `npm run check`
Expected: All linting and type checks pass.

**Step 3: Run full test suite**

Run: `npm run test`
Expected: All tests pass.

**Step 4: Run size check**

Run: `npm run size`
Expected: No significant size regressions.

**Step 5: Final commit if any stragglers**

```bash
git add -A && git commit -m "chore: final cleanup for ctor-kind enforcement (#300)"
```

---

### Task 19: Update design doc, update MEMORY.md

**Files:**
- Modify: `docs/plans/2026-02-22-ctor-kind-consistency-design.md` (mark completed)

**Step 1: Update design doc status**

Change status from "Approved" to "Implemented".

**Step 2: Commit**

```bash
git add docs/plans/2026-02-22-ctor-kind-consistency-design.md
git commit -m "docs: mark ctor-kind consistency design as implemented (#300)"
```
