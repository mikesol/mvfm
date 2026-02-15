# TSDoc Comments + api-extractor Enforcement — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add TSDoc comments to every public export and enforce coverage via `@microsoft/api-extractor`.

**Architecture:** Write TSDoc at declaration sites in source files. Configure api-extractor to validate the public API surface from `dist/index.d.ts`. Integrate into `npm run check` so CI enforces it.

**Tech Stack:** TypeScript, @microsoft/api-extractor

---

### Task 1: Set up api-extractor infrastructure

**Files:**
- Modify: `package.json`
- Create: `api-extractor.json`
- Create: `etc/` directory (for API report)

**Step 1: Install api-extractor**

Run: `npm install --save-dev @microsoft/api-extractor`

**Step 2: Create api-extractor.json**

Create `api-extractor.json` at repo root:

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/api-extractor/v7/api-extractor.schema.json",
  "mainEntryPointFilePath": "./dist/index.d.ts",
  "apiReport": {
    "enabled": true,
    "reportFolder": "./etc/"
  },
  "docModel": {
    "enabled": true,
    "apiJsonFilePath": "./etc/<unscopedPackageName>.api.json"
  },
  "dtsRollup": {
    "enabled": false
  },
  "messages": {
    "extractorMessageReporting": {
      "ae-missing-release-tag": {
        "logLevel": "none"
      }
    },
    "tsdocMessageReporting": {
      "tsdoc-undefined-tag": {
        "logLevel": "none"
      }
    }
  }
}
```

Note: We disable `ae-missing-release-tag` because we treat all exports as implicitly public (no `@public`/`@beta` tags needed). We disable `tsdoc-undefined-tag` to allow standard JSDoc tags.

**Step 3: Update package.json check script**

Change the `check` script from:
```
"check": "biome check ."
```
to:
```
"check": "biome check . && api-extractor run --local"
```

**Step 4: Build and run api-extractor to see baseline errors**

Run: `npm run build && npx api-extractor run --local 2>&1`

This will produce many warnings about missing documentation. Note the output — this is our checklist.

**Step 5: Create etc/ directory and generate initial API report**

The first run creates `etc/mvfm.api.md`. Add this directory to git tracking.

**Step 6: Commit**

```bash
git add api-extractor.json package.json package-lock.json etc/
git commit -m "feat: add api-extractor for TSDoc enforcement (#31)"
```

---

### Task 2: TSDoc for core types (`src/core.ts`)

**Files:**
- Modify: `src/core.ts`

Most core types already have TSDoc. Fill the gaps:

**Step 1: Add TSDoc to `TraitImpl` interface (line 124)**

```typescript
/**
 * Declares a typeclass trait implementation for a plugin's type.
 *
 * Maps a runtime type string (e.g. `"number"`) to the AST node kinds
 * that implement each operation in the trait.
 */
export interface TraitImpl {
```

**Step 2: Add TSDoc to `PluginDefinition` interface (line 129)**

```typescript
/**
 * Defines a plugin's contract: its name, the AST node kinds it emits,
 * and a build function that returns the methods it contributes to `$`.
 *
 * @example
 * ```ts
 * const myPlugin: PluginDefinition<MyMethods> = {
 *   name: "my",
 *   nodeKinds: ["my/op"],
 *   build(ctx) { return { op: (a) => ctx.expr({ kind: "my/op", a: ctx.lift(a).__node }) }; }
 * };
 * ```
 */
export interface PluginDefinition<T = any> {
```

**Step 3: Add TSDoc to `Plugin` type (line 154)**

```typescript
/**
 * A plugin export: either a bare {@link PluginDefinition} or a factory
 * function that returns one (for plugins requiring configuration).
 */
export type Plugin<T = any> = PluginDefinition<T> | (() => PluginDefinition<T>);
```

**Step 4: Add TSDoc to `Interpreter` type (line 168)**

```typescript
/**
 * An interpreter is a function that takes a {@link Program} and returns
 * a runner with an async `run` method.
 */
export type Interpreter = (program: Program) => {
```

**Step 5: Verify existing TSDoc on `Expr`, `ASTNode`, `Program`, `PluginContext`, `InterpreterFragment`, `composeInterpreters`, `mvfm` — these already have TSDoc, no changes needed unless gaps found.**

Review and confirm all exports from this file have comments.

**Step 6: Build and verify**

Run: `npm run build`
Expected: Clean build, no errors.

**Step 7: Commit**

```bash
git add src/core.ts
git commit -m "docs: add TSDoc to core types (#31)"
```

---

### Task 3: TSDoc for schema types (`src/schema.ts`)

**Files:**
- Modify: `src/schema.ts`

**Step 1: Add TSDoc to all schema exports**

```typescript
/**
 * Primitive runtime type tags used in schema declarations.
 */
export type SchemaTag = "string" | "number" | "boolean" | "date" | "null";

/**
 * Schema type representing an array of elements.
 */
export interface ArraySchema {
  readonly __tag: "array";
  readonly of: SchemaType;
}

/**
 * Schema type representing a nullable value.
 */
export interface NullableSchema {
  readonly __tag: "nullable";
  readonly of: SchemaType;
}

/**
 * A schema type: a primitive tag, array, nullable, or nested record.
 */
export type SchemaType =
  | SchemaTag
  | ArraySchema
  | NullableSchema
  | { readonly [key: string]: SchemaType };

/**
 * A record mapping field names to schema types, used to declare program input shapes.
 */
export type SchemaShape = Record<string, SchemaType>;
```

**Step 2: Add TSDoc to `InferSchema`**

```typescript
/**
 * Infers a TypeScript type from a runtime schema declaration.
 *
 * Maps {@link SchemaTag} primitives to their TS equivalents and recursively
 * resolves arrays, nullables, and nested records.
 */
export type InferSchema<S> = ...
```

**Step 3: Add TSDoc to runtime helper functions**

```typescript
/**
 * Creates an array schema type.
 *
 * @param of - The element schema type.
 * @returns An {@link ArraySchema} descriptor.
 *
 * @example
 * ```ts
 * const schema = { tags: array("string") };
 * ```
 */
export function array(of: SchemaType): ArraySchema {

/**
 * Creates a nullable schema type.
 *
 * @param of - The inner schema type that may be null.
 * @returns A {@link NullableSchema} descriptor.
 *
 * @example
 * ```ts
 * const schema = { nickname: nullable("string") };
 * ```
 */
export function nullable(of: SchemaType): NullableSchema {
```

**Step 4: Build and verify**

Run: `npm run build`

**Step 5: Commit**

```bash
git add src/schema.ts
git commit -m "docs: add TSDoc to schema types (#31)"
```

---

### Task 4: TSDoc for trait-utils (`src/trait-utils.ts`)

**Files:**
- Modify: `src/trait-utils.ts`

**Step 1: Add TSDoc to both exported functions**

```typescript
/**
 * Infers the runtime type of an AST node by checking it against registered
 * trait implementations.
 *
 * @param node - The AST node to type-check.
 * @param impls - Trait implementations to match against.
 * @param schema - Optional input schema for resolving property access types.
 * @returns The type string (e.g. `"number"`, `"string"`) or `null` if unresolvable.
 */
export function inferType(

/**
 * Resolves the schema type of a property access chain rooted at `core/input`.
 *
 * Walks backwards through nested `core/prop_access` nodes to reconstruct the
 * access path, then looks it up in the schema.
 *
 * @param node - A `core/prop_access` AST node.
 * @param schema - The program's input schema.
 * @returns The schema type string or `null` if the path doesn't resolve.
 */
export function resolveSchemaType(
```

**Step 2: Build and verify**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/trait-utils.ts
git commit -m "docs: add TSDoc to trait-utils (#31)"
```

---

### Task 5: TSDoc for num plugin (`src/plugins/num/index.ts`)

**Files:**
- Modify: `src/plugins/num/index.ts`

**Step 1: Add TSDoc to `NumMethods` interface and `num` definition**

```typescript
/**
 * Numeric operations beyond what the semiring typeclass provides.
 *
 * Includes subtraction, division, modular arithmetic, rounding, and min/max.
 * All methods accept raw numbers or `Expr<number>` (auto-lifted).
 */
export interface NumMethods {
  /** Subtract two numbers. */
  sub(a: Expr<number> | number, b: Expr<number> | number): Expr<number>;
  /** Divide two numbers. */
  div(a: Expr<number> | number, b: Expr<number> | number): Expr<number>;
  /** Modulo (remainder) of two numbers. */
  mod(a: Expr<number> | number, b: Expr<number> | number): Expr<number>;
  /** Negate a number. */
  neg(a: Expr<number> | number): Expr<number>;
  /** Absolute value. */
  abs(a: Expr<number> | number): Expr<number>;
  /** Round down to nearest integer. */
  floor(a: Expr<number> | number): Expr<number>;
  /** Round up to nearest integer. */
  ceil(a: Expr<number> | number): Expr<number>;
  /** Round to nearest integer. */
  round(a: Expr<number> | number): Expr<number>;
  /** Minimum of one or more numbers. */
  min(...values: (Expr<number> | number)[]): Expr<number>;
  /** Maximum of one or more numbers. */
  max(...values: (Expr<number> | number)[]): Expr<number>;
}

/**
 * Numeric operations plugin. Namespace: `num/`.
 *
 * Provides arithmetic beyond semiring (sub, div, mod), rounding, and
 * min/max. Also registers trait implementations for eq, ord, semiring,
 * show, and bounded.
 */
export const num: PluginDefinition<NumMethods> = {
```

**Step 2: Build and verify**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/plugins/num/index.ts
git commit -m "docs: add TSDoc to num plugin (#31)"
```

---

### Task 6: TSDoc for str plugin (`src/plugins/str/index.ts`)

**Files:**
- Modify: `src/plugins/str/index.ts`

**Step 1: Add TSDoc to `StrMethods` interface and `str` definition**

The interface already has a comment on `str` method. Add TSDoc to the interface itself and remaining methods:

```typescript
/**
 * String manipulation operations.
 *
 * All methods accept raw strings or `Expr<string>` (auto-lifted).
 */
export interface StrMethods {
  /** Tagged template literal for string interpolation: `$.str\`hello ${name}\`` */
  str(strings: TemplateStringsArray, ...exprs: (Expr<any> | string | number)[]): Expr<string>;
  /** Concatenate multiple string values. */
  concat(...parts: (Expr<string> | string)[]): Expr<string>;
  /** Convert to uppercase. */
  upper(s: Expr<string> | string): Expr<string>;
  /** Convert to lowercase. */
  lower(s: Expr<string> | string): Expr<string>;
  /** Remove leading and trailing whitespace. */
  trim(s: Expr<string> | string): Expr<string>;
  /** Extract a substring by start/end index. */
  slice(s: Expr<string> | string, start: Expr<number> | number, end?: Expr<number> | number): Expr<string>;
  /** Test whether a string contains a substring. */
  includes(haystack: Expr<string> | string, needle: Expr<string> | string): Expr<boolean>;
  /** Test whether a string starts with a prefix. */
  startsWith(s: Expr<string> | string, prefix: Expr<string> | string): Expr<boolean>;
  /** Test whether a string ends with a suffix. */
  endsWith(s: Expr<string> | string, suffix: Expr<string> | string): Expr<boolean>;
  /** Split a string by delimiter into an array. */
  split(s: Expr<string> | string, delimiter: Expr<string> | string): Expr<string[]>;
  /** Join an array of strings with a separator. */
  join(arr: Expr<string[]>, separator: Expr<string> | string): Expr<string>;
  /** Replace the first occurrence of a search string. */
  replace(s: Expr<string> | string, search: Expr<string> | string, replacement: Expr<string> | string): Expr<string>;
  /** Get the length of a string. */
  len(s: Expr<string> | string): Expr<number>;
}

/**
 * String operations plugin. Namespace: `str/`.
 *
 * Provides template literals, concatenation, case conversion, search, and
 * splitting. Registers trait implementations for eq, show, semigroup, and monoid.
 */
export const str: PluginDefinition<StrMethods> = {
```

**Step 2: Build and verify**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/plugins/str/index.ts
git commit -m "docs: add TSDoc to str plugin (#31)"
```

---

### Task 7: TSDoc for eq plugin (`src/plugins/eq/index.ts`)

**Files:**
- Modify: `src/plugins/eq/index.ts`

**Step 1: Add TSDoc**

```typescript
/**
 * Equality comparison operations dispatched via the Eq typeclass.
 *
 * Supports any type that has an eq trait implementation registered
 * (e.g. number via `num`, string via `str`, boolean via `boolean`).
 */
export interface EqMethods {
  /** Test structural equality of two values of the same type. */
  eq(a: Expr<number> | number, b: Expr<number> | number): Expr<boolean>;
  eq(a: Expr<string> | string, b: Expr<string> | string): Expr<boolean>;
  eq(a: Expr<boolean> | boolean, b: Expr<boolean> | boolean): Expr<boolean>;
  /** Test structural inequality (negated eq). */
  neq(a: Expr<number> | number, b: Expr<number> | number): Expr<boolean>;
  neq(a: Expr<string> | string, b: Expr<string> | string): Expr<boolean>;
  neq(a: Expr<boolean> | boolean, b: Expr<boolean> | boolean): Expr<boolean>;
}

/**
 * Equality typeclass plugin. Namespace: `eq/`.
 *
 * Dispatches `eq` and `neq` to the appropriate type-specific implementation
 * based on runtime type inference.
 */
export const eq: PluginDefinition<EqMethods> = {
```

**Step 2: Build and verify**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/plugins/eq/index.ts
git commit -m "docs: add TSDoc to eq plugin (#31)"
```

---

### Task 8: TSDoc for ord plugin (`src/plugins/ord/index.ts`)

**Files:**
- Modify: `src/plugins/ord/index.ts`

**Step 1: Add TSDoc**

```typescript
/**
 * Ordering comparison operations dispatched via the Ord typeclass.
 *
 * Provides `compare` (returns -1/0/1) and derived boolean comparisons.
 */
export interface OrdMethods {
  /** Three-way comparison returning -1, 0, or 1. */
  compare(a: Expr<number> | number, b: Expr<number> | number): Expr<number>;
  /** Greater than. */
  gt(a: Expr<number> | number, b: Expr<number> | number): Expr<boolean>;
  /** Greater than or equal. */
  gte(a: Expr<number> | number, b: Expr<number> | number): Expr<boolean>;
  /** Less than. */
  lt(a: Expr<number> | number, b: Expr<number> | number): Expr<boolean>;
  /** Less than or equal. */
  lte(a: Expr<number> | number, b: Expr<number> | number): Expr<boolean>;
}

/**
 * Ordering typeclass plugin. Namespace: `ord/`.
 *
 * Dispatches comparisons to type-specific implementations. Derives
 * `gt`, `gte`, `lt`, `lte` from the base `compare` operation.
 */
export const ord: PluginDefinition<OrdMethods> = {
```

**Step 2: Build and verify**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/plugins/ord/index.ts
git commit -m "docs: add TSDoc to ord plugin (#31)"
```

---

### Task 9: TSDoc for remaining typeclass plugins (boolean, bounded, show, semigroup, monoid, semiring, heytingAlgebra)

**Files:**
- Modify: `src/plugins/boolean/index.ts`
- Modify: `src/plugins/bounded/index.ts`
- Modify: `src/plugins/show/index.ts`
- Modify: `src/plugins/semigroup/index.ts`
- Modify: `src/plugins/monoid/index.ts`
- Modify: `src/plugins/semiring/index.ts`
- Modify: `src/plugins/heyting-algebra/index.ts`

**Step 1: Add TSDoc to each file**

`src/plugins/boolean/index.ts`:
```typescript
/** Boolean type plugin. Namespace: `boolean/`. Provides no direct methods — exposes trait implementations for eq, show, bounded, and heytingAlgebra. */
export type BooleanMethods = {};

/** Boolean type plugin. Registers boolean trait implementations for use by typeclass plugins. */
export const boolean: PluginDefinition<BooleanMethods> = {
```

`src/plugins/bounded/index.ts`:
```typescript
/** Bounded typeclass plugin — marker plugin that enables `top` and `bottom` dispatch for types with registered bounded traits. */
export type BoundedMethods = {};

/** Bounded typeclass plugin. No direct methods; dispatched through trait implementations registered by type plugins (e.g. `num`, `boolean`). */
export const bounded: PluginDefinition<BoundedMethods> = {
```

`src/plugins/show/index.ts`:
```typescript
/**
 * Show typeclass operations for converting values to their string representation.
 */
export interface ShowMethods {
  /** Convert a value to its string representation via the Show typeclass. */
  show(a: Expr<number> | number): Expr<string>;
  show(a: Expr<string> | string): Expr<string>;
  show(a: Expr<boolean> | boolean): Expr<string>;
}

/** Show typeclass plugin. Dispatches to type-specific `show` implementations. */
export const show: PluginDefinition<ShowMethods> = {
```

`src/plugins/semigroup/index.ts`:
```typescript
/**
 * Semigroup typeclass operations for associative binary combination.
 */
export interface SemigroupMethods {
  /** Combine two values using the semigroup's associative operation. */
  append(a: Expr<string> | string, b: Expr<string> | string): Expr<string>;
}

/** Semigroup typeclass plugin. Dispatches `append` to type-specific implementations. */
export const semigroup: PluginDefinition<SemigroupMethods> = {
```

`src/plugins/monoid/index.ts`:
```typescript
/** Monoid typeclass plugin — extends Semigroup with an identity element. No direct methods; dispatched through trait implementations. */
export type MonoidMethods = {};

/** Monoid typeclass plugin. Enables identity element dispatch for types with registered monoid traits. */
export const monoid: PluginDefinition<MonoidMethods> = {
```

`src/plugins/semiring/index.ts`:
```typescript
/**
 * Semiring typeclass operations providing addition and multiplication.
 */
export interface SemiringMethods {
  /** Add two values via the semiring typeclass. */
  add(a: Expr<number> | number, b: Expr<number> | number): Expr<number>;
  /** Multiply two values via the semiring typeclass. */
  mul(a: Expr<number> | number, b: Expr<number> | number): Expr<number>;
}

/** Semiring typeclass plugin. Namespace: `semiring/`. Dispatches `add` and `mul` to type-specific implementations. */
export const semiring: PluginDefinition<SemiringMethods> = {
```

`src/plugins/heyting-algebra/index.ts`:
```typescript
/**
 * Heyting algebra typeclass operations for lattice-based boolean logic.
 */
export interface HeytingAlgebraMethods {
  /** Logical conjunction (AND). */
  and(a: Expr<boolean>, b: Expr<boolean>): Expr<boolean>;
  /** Logical disjunction (OR). */
  or(a: Expr<boolean>, b: Expr<boolean>): Expr<boolean>;
  /** Logical negation (NOT). */
  not(a: Expr<boolean>): Expr<boolean>;
}

/** Heyting algebra typeclass plugin. Dispatches `and`, `or`, `not` to type-specific implementations. */
export const heytingAlgebra: PluginDefinition<HeytingAlgebraMethods> = {
```

**Step 2: Build and verify**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/plugins/boolean/index.ts src/plugins/bounded/index.ts src/plugins/show/index.ts src/plugins/semigroup/index.ts src/plugins/monoid/index.ts src/plugins/semiring/index.ts src/plugins/heyting-algebra/index.ts
git commit -m "docs: add TSDoc to typeclass plugins (#31)"
```

---

### Task 10: TSDoc for control and st plugins

**Files:**
- Modify: `src/plugins/control/index.ts`
- Modify: `src/plugins/st/index.ts`

**Step 1: Add TSDoc**

`src/plugins/control/index.ts`:
```typescript
/**
 * Control flow operations for iteration.
 */
export interface ControlMethods {
  /**
   * Iterate over each element of a collection, executing side effects.
   *
   * @param collection - The array expression to iterate.
   * @param body - Callback receiving each element as an `Expr<T>`.
   */
  each<T>(collection: Expr<T[]>, body: (item: Expr<T>) => void): void;
  /**
   * Loop while a condition is true.
   *
   * @param condition - Boolean expression to evaluate each iteration.
   * @returns A builder with a `body` method for the loop statements.
   */
  while(condition: Expr<boolean>): {
    body: (...statements: unknown[]) => void;
  };
}

/**
 * Control flow plugin. Namespace: `control/`.
 *
 * Provides `each` for collection iteration and `while` for conditional loops.
 */
export const control: PluginDefinition<ControlMethods> = {
```

`src/plugins/st/index.ts`:
```typescript
/**
 * Mutable state operations for local variables within a program.
 */
export interface StMethods {
  /**
   * Declare a mutable local variable.
   *
   * @param initial - The initial value.
   * @returns An object with `get`, `set`, and `push` methods.
   */
  let<T>(initial: Expr<T> | T): {
    get: () => Expr<T>;
    set: (value: Expr<T> | T) => void;
    push: (value: Expr<T>) => void;
  };
}

/**
 * Mutable state plugin. Namespace: `st/`.
 *
 * Provides `let` for declaring local mutable variables with get/set/push access.
 */
export const st: PluginDefinition<StMethods> = {
```

**Step 2: Build and verify**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/plugins/control/index.ts src/plugins/st/index.ts
git commit -m "docs: add TSDoc to control and st plugins (#31)"
```

---

### Task 11: TSDoc for error and fiber plugins (gap-fill only)

**Files:**
- Modify: `src/plugins/error/index.ts` (already has extensive TSDoc — verify and fill any gaps)
- Modify: `src/plugins/fiber/index.ts` (already has extensive TSDoc — verify and fill any gaps)

**Step 1: Read both files and check for missing TSDoc on any public export**

These files already have good documentation. Verify that the exported interfaces (`ErrorMethods`, `FiberMethods`) and plugin definitions (`error`, `fiber`) all have TSDoc. Add only if missing.

**Step 2: Build and verify**

Run: `npm run build`

**Step 3: Commit (only if changes were made)**

```bash
git add src/plugins/error/index.ts src/plugins/fiber/index.ts
git commit -m "docs: fill TSDoc gaps in error and fiber plugins (#31)"
```

---

### Task 12: TSDoc for postgres plugin (gap-fill only)

**Files:**
- Modify: `src/plugins/postgres/3.4.8/index.ts` (already has extensive TSDoc — verify)
- Modify: `src/plugins/postgres/3.4.8/interpreter.ts`
- Modify: `src/plugins/postgres/3.4.8/client-postgres-js.ts`

**Step 1: Verify TSDoc on postgres index.ts**

Already extensively documented. Confirm `PostgresMethods`, `PostgresConfig`, and `postgres` all have TSDoc.

**Step 2: Add TSDoc to `PostgresClient` and `postgresInterpreter` in interpreter.ts**

```typescript
/**
 * Database client interface consumed by the postgres interpreter.
 *
 * Abstracts over the actual database driver so interpreters can be
 * tested with mock clients.
 */
export interface PostgresClient {

/**
 * Interpreter fragment for postgres plugin nodes.
 *
 * @param client - A {@link PostgresClient} implementation.
 * @returns An {@link InterpreterFragment} handling all `postgres/` node kinds.
 */
export function postgresInterpreter(
```

**Step 3: Add TSDoc to `wrapPostgresJs` in client-postgres-js.ts**

```typescript
/**
 * Wraps a `postgres` (v3.4.x) SQL client into a {@link PostgresClient}.
 *
 * @param sql - A postgres-js SQL tagged template function.
 * @returns A {@link PostgresClient} adapter.
 */
export function wrapPostgresJs(
```

**Step 4: Build and verify**

Run: `npm run build`

**Step 5: Commit**

```bash
git add src/plugins/postgres/
git commit -m "docs: add TSDoc to postgres plugin exports (#31)"
```

---

### Task 13: TSDoc for all interpreter exports

**Files:**
- Modify: `src/interpreters/core.ts`
- Modify: `src/plugins/num/interpreter.ts`
- Modify: `src/plugins/str/interpreter.ts`
- Modify: `src/plugins/boolean/interpreter.ts`
- Modify: `src/plugins/eq/interpreter.ts`
- Modify: `src/plugins/ord/interpreter.ts`
- Modify: `src/plugins/error/interpreter.ts`
- Modify: `src/plugins/fiber/interpreter.ts`

**Step 1: Add a one-line TSDoc to each interpreter export**

Each interpreter is an `InterpreterFragment` const. Add a single TSDoc line:

- `coreInterpreter`: `/** Interpreter fragment for core node kinds (literal, input, prop_access, cond, do, program, tuple, record). */`
- `numInterpreter`: `/** Interpreter fragment for `num/` node kinds. */`
- `strInterpreter`: `/** Interpreter fragment for `str/` node kinds. */`
- `booleanInterpreter`: `/** Interpreter fragment for `boolean/` node kinds. */`
- `eqInterpreter`: `/** Interpreter fragment for `eq/` node kinds. */`
- `ordInterpreter`: `/** Interpreter fragment for `ord/` node kinds. */`
- `errorInterpreter`: `/** Interpreter fragment for `error/` node kinds. */` (check if already present)
- `fiberInterpreter`: `/** Interpreter fragment for `fiber/` node kinds. */` (check if already present)

**Step 2: Build and verify**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/interpreters/ src/plugins/*/interpreter.ts src/plugins/postgres/3.4.8/interpreter.ts
git commit -m "docs: add TSDoc to all interpreter exports (#31)"
```

---

### Task 14: Regenerate API report and final validation

**Files:**
- Modify: `etc/mvfm.api.md` (regenerated)

**Step 1: Full build + api-extractor**

Run: `npm run build && npx api-extractor run --local`

Expected: Clean run, no errors about missing documentation.

**Step 2: Run full check suite**

Run: `npm run check`

Expected: Biome passes, api-extractor passes.

**Step 3: Run tests**

Run: `npm test`

Expected: All tests pass (TSDoc changes are comment-only, no logic changes).

**Step 4: Commit API report**

```bash
git add etc/
git commit -m "docs: regenerate API report after TSDoc additions (#31)"
```

---

### Task 15: Final review and PR

**Step 1: Review all changes**

Run: `git diff main --stat` to see the full scope.

**Step 2: Run full validation**

Run: `npm run build && npm run check && npm test`

Expected: All green.

**Step 3: Create PR**

```bash
gh pr create --title "Add TSDoc comments to all public exports and enforce via lint" --body "$(cat <<'EOF'
Closes #31

## What this does

Adds TSDoc comments to every public export in the codebase and integrates
`@microsoft/api-extractor` into `npm run check` to enforce TSDoc coverage
going forward.

## Design alignment

- §8 Documentation: TSDoc on all public exports enables autogenerated API docs (#6).
  api-extractor produces a `.api.json` doc model for future Starlight integration.

## Validation performed

- `npm run build` — clean
- `npm run check` — biome + api-extractor both pass
- `npm test` — all tests pass (comment-only changes)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
