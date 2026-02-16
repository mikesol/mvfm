# Zod Plugin Merge-Friendly Split

## Problem

16 open PRs (#165–#180) each add a zod schema type. Every branch rewrites the same 3 files — `index.ts`, `interpreter.ts`, and sometimes `base.ts` — deleting previous schema types and replacing them with their own. Sequential merging is impossible without manual conflict resolution on every PR.

## Solution: Per-Schema Contribution Modules

Split each schema type's namespace factories, interpreter handlers, and node kinds into the schema's own module file. The barrel files (`index.ts`, `interpreter.ts`) become pure stitching — importing contributions and spreading them into the final objects. Each PR branch adds ~3 independent lines to the barrels, which git auto-merges cleanly.

## Contribution Contract

Each schema module (e.g., `string.ts`) exports alongside its builder class:

### 1. Node kinds

```ts
export const stringNodeKinds: string[] = ["zod/string"];
```

### 2. Namespace interface fragment

```ts
export interface ZodStringNamespace {
  string(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
}
```

### 3. Namespace factory

```ts
export function stringNamespace(
  ctx: PluginContext,
  parseError: (errorOrOpts?: string | { error?: string }) => string | undefined,
): ZodStringNamespace {
  return {
    string(errorOrOpts) {
      return new ZodStringBuilder(ctx, [], [], parseError(errorOrOpts));
    },
  };
}
```

### 4. Interpreter handler map

```ts
import { toZodError } from "./interpreter-utils";

export const stringInterpreter: SchemaInterpreterMap = {
  "zod/string": function* (node: ASTNode): Generator<StepEffect, z.ZodType, unknown> {
    const checks = (node.checks as CheckDescriptor[]) ?? [];
    const errorFn = toZodError(node.error as ErrorConfig | undefined);
    const base = errorFn ? z.string({ error: errorFn }) : z.string();
    return applyStringChecks(base, checks);
  },
};
```

The `applyStringChecks` helper stays in `string.ts` (private to the module). Same for `applyNumberChecks`/`variantChecks` in `number.ts`.

## Shared Types

New file `interpreter-utils.ts` exports shared helpers used by all schema interpreter handlers:

```ts
export type SchemaInterpreterMap = Record<
  string,
  (node: ASTNode) => Generator<StepEffect, z.ZodType, unknown>
>;
export function toZodError(error: ErrorConfig | undefined): ((iss: unknown) => string) | undefined;
export function checkErrorOpt(check: CheckDescriptor): { error?: (iss: unknown) => string };
```

## Barrel File Structure

### `index.ts` (after split)

```ts
import { stringNamespace, stringNodeKinds } from "./string";
import { numberNamespace, numberNodeKinds } from "./number";
// ^^^ Each branch adds ONE import line here

// Re-exports (each branch adds one line)
export { ZodStringBuilder } from "./string";
export { ZodNumberBuilder } from "./number";

// Composite namespace type
export interface ZodNamespace extends
  ZodStringNamespace,
  ZodNumberNamespace
  // ^^^ Each branch adds ONE extends clause here
{}

// Stable — never changes
const COMMON_NODE_KINDS = [
  "zod/parse", "zod/safe_parse", "zod/parse_async", "zod/safe_parse_async",
  "zod/optional", "zod/nullable", "zod/nullish", "zod/nonoptional",
  "zod/default", "zod/prefault", "zod/catch", "zod/readonly", "zod/branded",
];

export const zod: PluginDefinition<{ zod: ZodNamespace }> = {
  name: "zod",
  nodeKinds: [
    ...COMMON_NODE_KINDS,
    ...stringNodeKinds,
    ...numberNodeKinds,
    // ^^^ Each branch adds ONE spread here
  ],
  build(ctx) {
    return {
      zod: {
        ...stringNamespace(ctx, parseError),
        ...numberNamespace(ctx, parseError),
        // ^^^ Each branch adds ONE spread here
      } as ZodNamespace,
    };
  },
};
```

### `interpreter.ts` (after split)

```ts
import { stringInterpreter } from "./string";
import { numberInterpreter } from "./number";
// ^^^ Each branch adds ONE import line here

const schemaHandlers: SchemaInterpreterMap = {
  ...stringInterpreter,
  ...numberInterpreter,
  // ^^^ Each branch adds ONE spread here
};

function* buildSchemaGen(node: ASTNode): Generator<StepEffect, z.ZodType, unknown> {
  // Schema type dispatch (dynamic — never needs editing)
  const handler = schemaHandlers[node.kind];
  if (handler) return yield* handler(node);

  // Wrappers (stable — shared across all schema types, never changes)
  switch (node.kind) {
    case "zod/optional": return (yield* buildSchemaGen(node.inner as ASTNode)).optional();
    case "zod/nullable": return (yield* buildSchemaGen(node.inner as ASTNode)).nullable();
    // ... all wrapper cases stay here
    default: throw new Error(`unknown schema kind "${node.kind}"`);
  }
}

// zodInterpreter, applyRefinements, etc. — unchanged
```

## Files Changed (Retrofit on main)

| File | Action |
|------|--------|
| `interpreter-utils.ts` | **New** — `toZodError`, `checkErrorOpt`, `SchemaInterpreterMap` type |
| `string.ts` | **Add** — `stringNodeKinds`, `ZodStringNamespace`, `stringNamespace()`, `stringInterpreter`, `applyStringChecks` (moved from interpreter.ts) |
| `number.ts` | **Add** — `numberNodeKinds`, `ZodNumberNamespace`, `numberNamespace()`, `numberInterpreter`, `applyNumberChecks`, `variantChecks` (moved from interpreter.ts) |
| `index.ts` | **Rewrite** — barrel stitching pattern (imports + spreads) |
| `interpreter.ts` | **Rewrite** — handler map dispatch + stable wrappers/refinements |
| `base.ts` | **Unchanged** |
| `types.ts` | **Unchanged** |

## Propagation to PR Branches

After the retrofit merges to main, each of the 16 PR branches needs rebasing. Each branch's diff should collapse to:
1. One new schema module file (builder + namespace + interpreter + nodeKinds)
2. ~3-4 new lines in `index.ts` (import, extends, two spreads)
3. ~2 new lines in `interpreter.ts` (import, spread)
4. One new test file

These additions are on independent lines — no merge conflicts between branches.

## Merge Discipline

After retrofit, the split pattern eliminates structural conflicts — but PRs still merge **one at a time, sequentially against main**. Main must be clean after every merge.

### Rules

1. **Verify main is clean before every merge.** Run `build + check + test` on main. If anything fails — even if it's not from our work — fix it first. Do not merge onto a broken main. Errors compound.
2. **Merge one PR.** Squash or merge commit.
3. **Pull and verify immediately.** `build + check + test` on the updated main. If it fails, fix it NOW as a hotfix commit before touching the next PR.
4. **Repeat.** No batching, no skipping verification, no "we'll fix it later."

### Why sequential

The split pattern makes conflicts *unlikely* but doesn't make them *impossible*. Sequential merging guarantees each PR is validated against the actual state of main. Parallel merging can mask interaction bugs between schema types that share interpreter infrastructure.

### Suggested order

Start with simpler standalone types, build to complex ones:

1. #166 — boolean/null/undefined/void/symbol
2. #165 — bigint
3. #167 — date
4. #170 — literals
5. #171 — enum + native enum
6. #169 — coercion constructors
7. #168 — string formats
8. #172 — object
9. #173 — array
10. #174 — tuple
11. #175 — union/xor
12. #176 — intersection
13. #177 — record
14. #178 — map/set
15. #179 — transform/pipe/preprocess
16. #180 — any/unknown/never/promise/custom
