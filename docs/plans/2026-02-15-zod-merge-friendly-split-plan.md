# Zod Merge-Friendly Split Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the zod plugin so each schema type is self-contained in its own module, making the barrel files (`index.ts`, `interpreter.ts`) conflict-free for parallel PR merges.

**Architecture:** Each schema module exports its builder class, namespace factory, interpreter handler map, and node kinds. The barrels import and spread these contributions. Shared interpreter utilities move to `interpreter-utils.ts`.

**Tech Stack:** TypeScript, Vitest, pnpm, Zod v4+

**Working directory:** `packages/plugin-zod`

**Verify commands:** `cd /home/mikesol/Documents/GitHub/ilo/ilo && pnpm --filter @mvfm/plugin-zod run build && pnpm --filter @mvfm/plugin-zod run check && pnpm --filter @mvfm/plugin-zod run test`

---

### Task 1: Create `interpreter-utils.ts` with shared helpers

**Files:**
- Create: `packages/plugin-zod/src/interpreter-utils.ts`

**Step 1: Create the file**

Extract `toZodError`, `checkErrorOpt`, and the `SchemaInterpreterMap` type from `interpreter.ts` into a new shared module.

```ts
import type { ASTNode, StepEffect } from "@mvfm/core";
import type { z } from "zod";
import type { CheckDescriptor, ErrorConfig } from "./types";

/**
 * Handler function type for schema interpreter dispatch.
 * Each schema module exports a map of `{ [nodeKind]: handler }`.
 */
export type SchemaInterpreterMap = Record<
  string,
  (node: ASTNode) => Generator<StepEffect, z.ZodType, unknown>
>;

/**
 * Convert an ErrorConfig (string or ASTNode) to a Zod-compatible error function.
 * String errors become a function that returns the string for all issues.
 * ASTNode errors would need interpreter context to evaluate — stored as descriptive string.
 */
export function toZodError(error: ErrorConfig | undefined): ((iss: unknown) => string) | undefined {
  if (error === undefined) return undefined;
  if (typeof error === "string") return () => error;
  return () => `[dynamic error: ${JSON.stringify(error)}]`;
}

/**
 * Build check-level error option for Zod check methods.
 * Returns `{ error: fn }` if error is present, otherwise empty object.
 */
export function checkErrorOpt(check: CheckDescriptor): { error?: (iss: unknown) => string } {
  const fn = toZodError(check.error as ErrorConfig | undefined);
  return fn ? { error: fn } : {};
}
```

**Step 2: Run build to verify it compiles**

Run: `cd /home/mikesol/Documents/GitHub/ilo/ilo && pnpm --filter @mvfm/plugin-zod run build`
Expected: SUCCESS (new file, nothing imports it yet)

**Step 3: Commit**

```
git add packages/plugin-zod/src/interpreter-utils.ts
git commit -m "refactor(plugin-zod): extract shared interpreter utils"
```

---

### Task 2: Add contribution exports to `string.ts`

**Files:**
- Modify: `packages/plugin-zod/src/string.ts`

**Step 1: Add imports and contribution exports**

Add these exports at the bottom of `string.ts`, after the `ZodStringBuilder` class:

```ts
import type { PluginContext } from "@mvfm/core";  // already imported at top
import type { ASTNode, StepEffect } from "@mvfm/core";  // extend existing import
import { z } from "zod";
import { checkErrorOpt, toZodError } from "./interpreter-utils";
import type { SchemaInterpreterMap } from "./interpreter-utils";
```

Update the existing `@mvfm/core` import at line 1 to include `StepEffect`:

```ts
import type { ASTNode, PluginContext, StepEffect } from "@mvfm/core";
```

Add a `zod` import:

```ts
import { z } from "zod";
```

Add imports from interpreter-utils:

```ts
import { checkErrorOpt, toZodError } from "./interpreter-utils";
import type { SchemaInterpreterMap } from "./interpreter-utils";
```

Then add these exports after the class definition:

```ts
/** Node kinds contributed by the string schema. */
export const stringNodeKinds: string[] = ["zod/string"];

/**
 * Namespace fragment for string schema factories.
 */
export interface ZodStringNamespace {
  /** Create a string schema builder. */
  string(errorOrOpts?: string | { error?: string }): ZodStringBuilder;
}

/** Build the string namespace factory methods. */
export function stringNamespace(
  ctx: PluginContext,
  parseError: (errorOrOpts?: string | { error?: string }) => string | undefined,
): ZodStringNamespace {
  return {
    string(errorOrOpts?: string | { error?: string }): ZodStringBuilder {
      return new ZodStringBuilder(ctx, [], [], parseError(errorOrOpts));
    },
  };
}

/**
 * Apply check descriptors to a Zod string schema.
 * Each check kind maps to the corresponding Zod method.
 * Validations produce z.ZodString; transforms produce z.ZodPipe.
 */
function applyStringChecks(schema: z.ZodString, checks: CheckDescriptor[]): z.ZodType {
  let s: z.ZodType = schema;
  for (const check of checks) {
    const errOpt = checkErrorOpt(check);
    switch (check.kind) {
      case "min_length":
        s = (s as z.ZodString).min(check.value as number, errOpt);
        break;
      case "max_length":
        s = (s as z.ZodString).max(check.value as number, errOpt);
        break;
      case "length":
        s = (s as z.ZodString).length(check.value as number, errOpt);
        break;
      case "regex":
        s = (s as z.ZodString).regex(
          new RegExp(check.pattern as string, (check.flags as string) ?? ""),
          errOpt,
        );
        break;
      case "starts_with":
        s = (s as z.ZodString).startsWith(check.value as string, errOpt);
        break;
      case "ends_with":
        s = (s as z.ZodString).endsWith(check.value as string, errOpt);
        break;
      case "includes":
        s = (s as z.ZodString).includes(check.value as string, errOpt);
        break;
      case "uppercase":
        s = (s as z.ZodString).regex(/^[^a-z]*$/, errOpt);
        break;
      case "lowercase":
        s = (s as z.ZodString).regex(/^[^A-Z]*$/, errOpt);
        break;
      case "trim":
        s = (s as z.ZodString).trim();
        break;
      case "to_lower_case":
        s = (s as z.ZodString).toLowerCase();
        break;
      case "to_upper_case":
        s = (s as z.ZodString).toUpperCase();
        break;
      case "normalize":
        s = (s as z.ZodString).normalize(check.form as string);
        break;
      default:
        throw new Error(`Zod interpreter: unknown string check "${check.kind}"`);
    }
  }
  return s;
}

/** Interpreter handlers for string schema nodes. */
export const stringInterpreter: SchemaInterpreterMap = {
  "zod/string": function* (node: ASTNode): Generator<StepEffect, z.ZodType, unknown> {
    const checks = (node.checks as CheckDescriptor[]) ?? [];
    const errorFn = toZodError(node.error as ErrorConfig | undefined);
    const base = errorFn ? z.string({ error: errorFn }) : z.string();
    return applyStringChecks(base, checks);
  },
};
```

**Step 2: Run build**

Run: `cd /home/mikesol/Documents/GitHub/ilo/ilo && pnpm --filter @mvfm/plugin-zod run build`
Expected: SUCCESS

**Step 3: Commit**

```
git add packages/plugin-zod/src/string.ts
git commit -m "refactor(plugin-zod): add contribution exports to string module"
```

---

### Task 3: Add contribution exports to `number.ts`

**Files:**
- Modify: `packages/plugin-zod/src/number.ts`

**Step 1: Add imports and contribution exports**

Update the import at the top:

```ts
import type { ASTNode, PluginContext, StepEffect } from "@mvfm/core";
```

Add new imports:

```ts
import { z } from "zod";
import { checkErrorOpt, toZodError } from "./interpreter-utils";
import type { SchemaInterpreterMap } from "./interpreter-utils";
```

Then add these exports after the class definition:

```ts
/** Node kinds contributed by the number schema. */
export const numberNodeKinds: string[] = ["zod/number", "zod/nan"];

/**
 * Namespace fragment for number schema factories.
 */
export interface ZodNumberNamespace {
  /** Create a number schema builder. */
  number(errorOrOpts?: string | { error?: string }): ZodNumberBuilder;
  /** Create an integer schema builder (safe integer range). */
  int(errorOrOpts?: string | { error?: string }): ZodNumberBuilder;
  /** Create an int32 schema builder. */
  int32(errorOrOpts?: string | { error?: string }): ZodNumberBuilder;
  /** Create an int64 schema builder. */
  int64(errorOrOpts?: string | { error?: string }): ZodNumberBuilder;
  /** Create a uint32 schema builder. */
  uint32(errorOrOpts?: string | { error?: string }): ZodNumberBuilder;
  /** Create a uint64 schema builder. */
  uint64(errorOrOpts?: string | { error?: string }): ZodNumberBuilder;
  /** Create a float32 schema builder. */
  float32(errorOrOpts?: string | { error?: string }): ZodNumberBuilder;
  /** Create a float64 schema builder. */
  float64(errorOrOpts?: string | { error?: string }): ZodNumberBuilder;
  /** Create a NaN schema builder. */
  nan(errorOrOpts?: string | { error?: string }): ZodNumberBuilder;
}

/** Build the number namespace factory methods. */
export function numberNamespace(
  ctx: PluginContext,
  parseError: (errorOrOpts?: string | { error?: string }) => string | undefined,
): ZodNumberNamespace {
  return {
    number(errorOrOpts?: string | { error?: string }): ZodNumberBuilder {
      return new ZodNumberBuilder(ctx, [], [], parseError(errorOrOpts));
    },
    int(errorOrOpts?: string | { error?: string }): ZodNumberBuilder {
      return new ZodNumberBuilder(ctx, [], [], parseError(errorOrOpts), { variant: "int" });
    },
    int32(errorOrOpts?: string | { error?: string }): ZodNumberBuilder {
      return new ZodNumberBuilder(ctx, [], [], parseError(errorOrOpts), { variant: "int32" });
    },
    int64(errorOrOpts?: string | { error?: string }): ZodNumberBuilder {
      return new ZodNumberBuilder(ctx, [], [], parseError(errorOrOpts), { variant: "int64" });
    },
    uint32(errorOrOpts?: string | { error?: string }): ZodNumberBuilder {
      return new ZodNumberBuilder(ctx, [], [], parseError(errorOrOpts), { variant: "uint32" });
    },
    uint64(errorOrOpts?: string | { error?: string }): ZodNumberBuilder {
      return new ZodNumberBuilder(ctx, [], [], parseError(errorOrOpts), { variant: "uint64" });
    },
    float32(errorOrOpts?: string | { error?: string }): ZodNumberBuilder {
      return new ZodNumberBuilder(ctx, [], [], parseError(errorOrOpts), { variant: "float32" });
    },
    float64(errorOrOpts?: string | { error?: string }): ZodNumberBuilder {
      return new ZodNumberBuilder(ctx, [], [], parseError(errorOrOpts), { variant: "float64" });
    },
    nan(errorOrOpts?: string | { error?: string }): ZodNumberBuilder {
      return new ZodNumberBuilder(ctx, [], [], parseError(errorOrOpts), {}, "zod/nan");
    },
  };
}

/**
 * Apply check descriptors to a Zod number schema.
 */
function applyNumberChecks(schema: z.ZodNumber, checks: CheckDescriptor[]): z.ZodNumber {
  let s = schema;
  for (const check of checks) {
    const errOpt = checkErrorOpt(check);
    switch (check.kind) {
      case "gt":
        s = s.gt(check.value as number, errOpt);
        break;
      case "gte":
        s = s.gte(check.value as number, errOpt);
        break;
      case "lt":
        s = s.lt(check.value as number, errOpt);
        break;
      case "lte":
        s = s.lte(check.value as number, errOpt);
        break;
      case "positive":
        s = s.positive(errOpt);
        break;
      case "nonnegative":
        s = s.nonnegative(errOpt);
        break;
      case "negative":
        s = s.negative(errOpt);
        break;
      case "nonpositive":
        s = s.nonpositive(errOpt);
        break;
      case "multiple_of":
        s = s.multipleOf(check.value as number, errOpt);
        break;
      case "int":
        s = s.int(errOpt);
        break;
      case "finite":
        s = s.finite(errOpt);
        break;
      case "safe":
        s = s.safe(errOpt);
        break;
      default:
        throw new Error(`Zod interpreter: unknown number check "${check.kind}"`);
    }
  }
  return s;
}

/**
 * Build variant-specific number checks from the variant field.
 */
function variantChecks(variant: string | undefined): CheckDescriptor[] {
  switch (variant) {
    case "int":
      return [{ kind: "int" }, { kind: "safe" }];
    case "int32":
      return [
        { kind: "int" },
        { kind: "gte", value: -2147483648 },
        { kind: "lte", value: 2147483647 },
      ];
    case "int64":
      return [{ kind: "int" }, { kind: "safe" }];
    case "uint32":
      return [{ kind: "int" }, { kind: "gte", value: 0 }, { kind: "lte", value: 4294967295 }];
    case "uint64":
      return [{ kind: "int" }, { kind: "gte", value: 0 }, { kind: "safe" }];
    case "float32":
      return [
        { kind: "finite" },
        { kind: "gte", value: -3.4028235e38 },
        { kind: "lte", value: 3.4028235e38 },
      ];
    case "float64":
      return [{ kind: "finite" }];
    default:
      return [];
  }
}

/** Interpreter handlers for number schema nodes. */
export const numberInterpreter: SchemaInterpreterMap = {
  "zod/number": function* (node: ASTNode): Generator<StepEffect, z.ZodType, unknown> {
    const variant = node.variant as string | undefined;
    const explicitChecks = (node.checks as CheckDescriptor[]) ?? [];
    const vChecks = variantChecks(variant);
    const allChecks = [...vChecks, ...explicitChecks];
    const errorFn = toZodError(node.error as ErrorConfig | undefined);
    const base = errorFn ? z.number({ error: errorFn }) : z.number();
    return applyNumberChecks(base, allChecks);
  },
  "zod/nan": function* (node: ASTNode): Generator<StepEffect, z.ZodType, unknown> {
    const errorFn = toZodError(node.error as ErrorConfig | undefined);
    return errorFn ? z.nan({ error: errorFn }) : z.nan();
  },
};
```

**Step 2: Run build**

Run: `cd /home/mikesol/Documents/GitHub/ilo/ilo && pnpm --filter @mvfm/plugin-zod run build`
Expected: SUCCESS

**Step 3: Commit**

```
git add packages/plugin-zod/src/number.ts
git commit -m "refactor(plugin-zod): add contribution exports to number module"
```

---

### Task 4: Rewrite `interpreter.ts` to use handler map dispatch

**Files:**
- Modify: `packages/plugin-zod/src/interpreter.ts`

**Step 1: Rewrite interpreter.ts**

Replace the entire file with:

```ts
import type { ASTNode, InterpreterFragment, StepEffect } from "@mvfm/core";
import { injectLambdaParam } from "@mvfm/core";
import type { z } from "zod";
import type { SchemaInterpreterMap } from "./interpreter-utils";
import { toZodError } from "./interpreter-utils";
import { numberInterpreter } from "./number";
import { stringInterpreter } from "./string";
import type { ErrorConfig, RefinementDescriptor } from "./types";

// ---- Schema handler dispatch ----
// Each schema module exports an interpreter map.
// New schema types add ONE import + ONE spread here.

const schemaHandlers: SchemaInterpreterMap = {
  ...stringInterpreter,
  ...numberInterpreter,
};

/**
 * Build a Zod schema from a schema AST node (generator version).
 * Dispatches to per-schema handlers, then handles shared wrappers.
 */
function* buildSchemaGen(node: ASTNode): Generator<StepEffect, z.ZodType, unknown> {
  // Schema type dispatch
  const handler = schemaHandlers[node.kind];
  if (handler) return yield* handler(node);

  // Shared wrappers (stable — never changes per schema type)
  switch (node.kind) {
    case "zod/optional":
      return (yield* buildSchemaGen(node.inner as ASTNode)).optional();
    case "zod/nullable":
      return (yield* buildSchemaGen(node.inner as ASTNode)).nullable();
    case "zod/nullish":
      return (yield* buildSchemaGen(node.inner as ASTNode)).nullish();
    case "zod/nonoptional":
      return (yield* buildSchemaGen(node.inner as ASTNode) as any).nonoptional();
    case "zod/readonly":
      return (yield* buildSchemaGen(node.inner as ASTNode)).readonly();
    case "zod/branded":
      return (yield* buildSchemaGen(node.inner as ASTNode)).brand(node.brand as string);
    case "zod/default": {
      const inner = yield* buildSchemaGen(node.inner as ASTNode);
      const value = yield { type: "recurse", child: node.value as ASTNode };
      return inner.default(value);
    }
    case "zod/prefault": {
      const inner = yield* buildSchemaGen(node.inner as ASTNode);
      const value = yield { type: "recurse", child: node.value as ASTNode };
      return (inner as any).prefault(value);
    }
    case "zod/catch": {
      const inner = yield* buildSchemaGen(node.inner as ASTNode);
      const value = yield { type: "recurse", child: node.value as ASTNode };
      return inner.catch(value);
    }
    default:
      throw new Error(`Zod interpreter: unknown schema kind "${node.kind}"`);
  }
}

/**
 * Build parse-level error option from the parseError field on validation nodes.
 */
function parseErrorOpt(node: ASTNode): { error?: (iss: unknown) => string } {
  const fn = toZodError(node.parseError as ErrorConfig | undefined);
  return fn ? { error: fn } : {};
}

/**
 * Extract refinements from a schema AST node.
 */
function extractRefinements(schemaNode: ASTNode): RefinementDescriptor[] {
  return (schemaNode.refinements as RefinementDescriptor[] | undefined) ?? [];
}

/**
 * Apply refinement descriptors to a validated value via the generator pipeline.
 */
function* applyRefinements(
  value: unknown,
  refinements: RefinementDescriptor[],
): Generator<StepEffect, unknown, unknown> {
  let current = value;
  for (const ref of refinements) {
    const lambda = ref.fn as unknown as { param: { name: string }; body: ASTNode };
    const bodyClone = structuredClone(lambda.body);
    injectLambdaParam(bodyClone, lambda.param.name, current);
    const result = yield { type: "recurse", child: bodyClone };

    switch (ref.kind) {
      case "refine":
      case "check":
        if (!result) {
          throw new Error(typeof ref.error === "string" ? ref.error : "Refinement failed");
        }
        break;
      case "overwrite":
        current = result;
        break;
      case "super_refine":
        break;
    }
  }
  return current;
}

/**
 * Interpreter fragment for `zod/` node kinds.
 *
 * Handles parsing operation nodes by recursing into schema + input,
 * reconstructing the Zod schema from AST, and executing validation.
 */
export const zodInterpreter: InterpreterFragment = {
  pluginName: "zod",
  canHandle: (node) => node.kind.startsWith("zod/"),
  *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
    switch (node.kind) {
      case "zod/parse": {
        const schemaNode = node.schema as ASTNode;
        const schema = yield* buildSchemaGen(schemaNode);
        const input = yield { type: "recurse", child: node.input as ASTNode };
        let value = schema.parse(input, parseErrorOpt(node));
        const refinements = extractRefinements(schemaNode);
        if (refinements.length > 0) {
          value = yield* applyRefinements(value, refinements);
        }
        return value;
      }
      case "zod/safe_parse": {
        const schemaNode = node.schema as ASTNode;
        const schema = yield* buildSchemaGen(schemaNode);
        const input = yield { type: "recurse", child: node.input as ASTNode };
        const result = schema.safeParse(input, parseErrorOpt(node));
        if (!result.success) return result;
        const refinements = extractRefinements(schemaNode);
        if (refinements.length > 0) {
          try {
            const refined = yield* applyRefinements(result.data, refinements);
            return { success: true, data: refined };
          } catch (e) {
            return { success: false, error: e };
          }
        }
        return result;
      }
      case "zod/parse_async": {
        const schemaNode = node.schema as ASTNode;
        const schema = yield* buildSchemaGen(schemaNode);
        const input = yield { type: "recurse", child: node.input as ASTNode };
        let value = schema.parse(input, parseErrorOpt(node));
        const refinements = extractRefinements(schemaNode);
        if (refinements.length > 0) {
          value = yield* applyRefinements(value, refinements);
        }
        return value;
      }
      case "zod/safe_parse_async": {
        const schemaNode = node.schema as ASTNode;
        const schema = yield* buildSchemaGen(schemaNode);
        const input = yield { type: "recurse", child: node.input as ASTNode };
        const result = schema.safeParse(input, parseErrorOpt(node));
        if (!result.success) return result;
        const refinements = extractRefinements(schemaNode);
        if (refinements.length > 0) {
          try {
            const refined = yield* applyRefinements(result.data, refinements);
            return { success: true, data: refined };
          } catch (e) {
            return { success: false, error: e };
          }
        }
        return result;
      }
      default:
        throw new Error(`Zod interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
```

**Step 2: Run build**

Run: `cd /home/mikesol/Documents/GitHub/ilo/ilo && pnpm --filter @mvfm/plugin-zod run build`
Expected: SUCCESS

**Step 3: Commit**

```
git add packages/plugin-zod/src/interpreter.ts
git commit -m "refactor(plugin-zod): rewrite interpreter with handler map dispatch"
```

---

### Task 5: Rewrite `index.ts` as a barrel stitching file

**Files:**
- Modify: `packages/plugin-zod/src/index.ts`

**Step 1: Rewrite index.ts**

Replace the entire file with:

```ts
import type { PluginDefinition } from "@mvfm/core";
import { numberNamespace, numberNodeKinds } from "./number";
import type { ZodNumberNamespace } from "./number";
import { stringNamespace, stringNodeKinds } from "./string";
import type { ZodStringNamespace } from "./string";

// Re-export types, builders, and interpreter for consumers
export { ZodSchemaBuilder, ZodWrappedBuilder } from "./base";
export { zodInterpreter } from "./interpreter";
export { ZodNumberBuilder } from "./number";
export { ZodStringBuilder } from "./string";
export type {
  CheckDescriptor,
  ErrorConfig,
  RefinementDescriptor,
  SchemaASTNode,
  ValidationASTNode,
  WrapperASTNode,
} from "./types";
export type { SchemaInterpreterMap } from "./interpreter-utils";

/**
 * The `$.zod` namespace contributed by the Zod plugin.
 *
 * Provides factory methods for creating Zod schema builders:
 * `$.zod.string()`, `$.zod.number()`, `$.zod.object(...)`, etc.
 *
 * Each factory returns a schema builder with chainable methods
 * for adding checks, refinements, and wrappers. Call `.parse()`
 * or `.safeParse()` to produce a validation AST node.
 */
export interface ZodNamespace extends
  ZodStringNamespace,
  ZodNumberNamespace
  // ^^^ Each new schema type adds ONE extends clause here
{}

/** Parse error config from the standard `errorOrOpts` param. */
function parseError(errorOrOpts?: string | { error?: string }): string | undefined {
  return typeof errorOrOpts === "string" ? errorOrOpts : errorOrOpts?.error;
}

/** Parsing and wrapper node kinds shared across all schema types. */
const COMMON_NODE_KINDS: string[] = [
  "zod/parse",
  "zod/safe_parse",
  "zod/parse_async",
  "zod/safe_parse_async",
  "zod/optional",
  "zod/nullable",
  "zod/nullish",
  "zod/nonoptional",
  "zod/default",
  "zod/prefault",
  "zod/catch",
  "zod/readonly",
  "zod/branded",
];

/**
 * Zod validation DSL plugin for mvfm.
 *
 * Adds the `$.zod` namespace to the dollar object, providing factory
 * methods for building Zod-compatible validation schemas as AST nodes.
 * The default interpreter reconstructs actual Zod schemas at runtime.
 *
 * Requires `zod` v4+ as a peer dependency.
 */
export const zod: PluginDefinition<{ zod: ZodNamespace }> = {
  name: "zod",

  nodeKinds: [
    ...COMMON_NODE_KINDS,
    ...stringNodeKinds,
    ...numberNodeKinds,
    // ^^^ Each new schema type adds ONE spread here
  ],

  build(ctx) {
    return {
      zod: {
        ...stringNamespace(ctx, parseError),
        ...numberNamespace(ctx, parseError),
        // ^^^ Each new schema type adds ONE spread here
      } as ZodNamespace,
    };
  },
};
```

**Step 2: Run build**

Run: `cd /home/mikesol/Documents/GitHub/ilo/ilo && pnpm --filter @mvfm/plugin-zod run build`
Expected: SUCCESS

**Step 3: Commit**

```
git add packages/plugin-zod/src/index.ts
git commit -m "refactor(plugin-zod): rewrite index.ts as barrel stitching file"
```

---

### Task 6: Run full verification

**Step 1: Run the complete verify suite**

Run: `cd /home/mikesol/Documents/GitHub/ilo/ilo && pnpm --filter @mvfm/plugin-zod run build && pnpm --filter @mvfm/plugin-zod run check && pnpm --filter @mvfm/plugin-zod run test`
Expected: All pass — build succeeds, linter passes, all existing tests pass unchanged.

The tests should pass without any modifications because:
- All public exports are preserved (same names, same types)
- `zodInterpreter` behavior is identical (same logic, just dispatched differently)
- `zod` plugin definition is identical (same nodeKinds, same build output)

**Step 2: If tests fail, debug and fix**

Common issues:
- Import paths: ensure `interpreter-utils.ts` is reachable from both `string.ts` and `number.ts`
- Type compatibility: `SchemaInterpreterMap` values must match generator signatures
- Missing re-exports: ensure all previously exported names are still exported from `index.ts`

**Step 3: Final commit if any fixes were needed**

```
git add -A
git commit -m "fix(plugin-zod): resolve any issues from split refactor"
```

---

### Task 7: Verify file sizes are under 300-line limit

**Step 1: Check line counts**

Run: `wc -l packages/plugin-zod/src/*.ts`

Expected approximate line counts:
- `interpreter-utils.ts`: ~35 lines
- `string.ts`: ~235 lines (136 original + ~100 contribution exports)
- `number.ts`: ~280 lines (127 original + ~155 contribution exports)
- `interpreter.ts`: ~155 lines (wrappers + parse ops + refinements)
- `index.ts`: ~90 lines (barrel stitching)
- `base.ts`: ~362 lines (unchanged — already over limit, tracked separately)
- `types.ts`: ~93 lines (unchanged)

**Step 2: If any file exceeds 300 lines, split further**

If `number.ts` exceeds 300 lines, extract `applyNumberChecks` + `variantChecks` + `numberInterpreter` into `number-interpreter.ts` and re-export from `number.ts`.

If `string.ts` exceeds 300 lines, extract `applyStringChecks` + `stringInterpreter` into `string-interpreter.ts` and re-export from `string.ts`.

**Step 3: Commit if splitting was needed**

```
git add packages/plugin-zod/src/
git commit -m "refactor(plugin-zod): split oversized modules to stay under 300-line limit"
```

---

### Task 8: Rebase all 16 PR branches onto the new main

Each PR branch must be updated to use the contribution pattern instead of rewriting the monolithic files. For each branch:

1. Rebase onto main: `git rebase main`
2. Resolve conflicts by adopting the new barrel pattern — delete the monolithic edits to `index.ts` and `interpreter.ts`, keep only the new schema module file
3. Add the contribution exports (nodeKinds, namespace interface, namespace factory, interpreter map) to the schema module file
4. Add the barrel lines (import + spread) to `index.ts` and `interpreter.ts`
5. Verify: `pnpm --filter @mvfm/plugin-zod run build && pnpm --filter @mvfm/plugin-zod run check && pnpm --filter @mvfm/plugin-zod run test`
6. Force-push the rebased branch

---

### Task 9: Sequential merge to main

**This is the critical discipline. PRs merge ONE AT A TIME against main. Main must be clean after every merge.**

**Procedure for each PR:**

1. **Ensure main is clean before starting.** Run the full verify suite on main:
   ```
   git checkout main && pnpm --filter @mvfm/plugin-zod run build && pnpm --filter @mvfm/plugin-zod run check && pnpm --filter @mvfm/plugin-zod run test
   ```
   If main is not clean — regardless of whether the failure is from our work or someone else's — **STOP and fix main first**. Do not proceed with any merge until main passes all checks. No exceptions.

2. **Merge the next PR.** Use GitHub's merge button or `gh pr merge <N>`. Prefer squash or merge commit (not rebase) to keep the PR as a single unit.

3. **Pull main and verify immediately:**
   ```
   git checkout main && git pull && pnpm --filter @mvfm/plugin-zod run build && pnpm --filter @mvfm/plugin-zod run check && pnpm --filter @mvfm/plugin-zod run test
   ```

4. **If verification fails, fix it NOW** before merging the next PR. The fix goes directly to main as a hotfix commit. Do not let a broken main accumulate — errors compound.

5. **Repeat for the next PR.** If the next branch has minor conflicts from the previous merge (e.g., adjacent lines in the barrel files), resolve them, verify, and continue.

**Why sequential:** Even though the split pattern makes conflicts unlikely, sequential merging guarantees that each PR is validated against the actual state of main. Parallel merging (even via GitHub's merge queue) can mask interaction bugs between schema types that share interpreter infrastructure.

**Suggested merge order:** Start with simpler, standalone schema types to build confidence, then move to complex ones:

1. #166 — boolean, null, undefined, void, symbol (simple, no checks)
2. #165 — bigint (similar pattern to number)
3. #167 — date (simple with min/max)
4. #170 — literals
5. #171 — enum + native enum
6. #169 — coercion constructors
7. #168 — string formats
8. #172 — object schemas
9. #173 — array
10. #174 — tuple
11. #175 — union/xor
12. #176 — intersection
13. #177 — record
14. #178 — map/set
15. #179 — transform/pipe/preprocess
16. #180 — any/unknown/never/nan/promise/custom
