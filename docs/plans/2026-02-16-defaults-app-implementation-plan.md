# `defaults(app)` Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `defaults(app)` function that derives a complete interpreter from an mvfm app's plugin list, with full compile-time safety for missing overrides.

**Architecture:** Add optional `defaultInterpreter` field to `PluginDefinition`. Expose resolved plugins on `mvfm()` return value via a callable object with `.plugins`. Implement `defaults()` as a type-safe function that collects default interpreters and merges overrides.

**Tech Stack:** TypeScript (structural typing, conditional types, mapped types), vitest

---

### Task 1: Add `defaultInterpreter` to `PluginDefinition`

**Files:**
- Modify: `packages/core/src/types.ts:143-157`

**Step 1: Write the failing test**

Create test file `packages/core/tests/defaults.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Interpreter, PluginDefinition } from "../src/core";

describe("PluginDefinition.defaultInterpreter", () => {
  it("accepts a plugin with defaultInterpreter field", () => {
    const interp: Interpreter = {
      "test/noop": async function* () {
        return null;
      },
    };
    const plugin: PluginDefinition & { defaultInterpreter: Interpreter } = {
      name: "test",
      nodeKinds: ["test/noop"],
      build: () => ({}),
      defaultInterpreter: interp,
    };
    expect(plugin.defaultInterpreter).toBe(interp);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/core && npx vitest run tests/defaults.test.ts`
Expected: FAIL — `defaultInterpreter` is not assignable to `PluginDefinition` (the `&` intersection works regardless, but this validates the setup).

Actually this test will pass even before the change because of the intersection type. Let's write a test that validates the structural discrimination — the real type-level feature:

```ts
import { describe, expect, it } from "vitest";
import type { Interpreter } from "../src/core";

describe("defaults() type infrastructure", () => {
  it("structural discrimination: plugin with defaultInterpreter extends { defaultInterpreter: Interpreter }", () => {
    // This is a compile-time test — if it compiles, it passes
    type HasDefault<P> = P extends { defaultInterpreter: Interpreter }
      ? true
      : false;

    const withDefault = {
      name: "num" as const,
      nodeKinds: ["num/add"],
      build: () => ({}),
      defaultInterpreter: {} as Interpreter,
    };

    const withoutDefault = {
      name: "postgres" as const,
      nodeKinds: ["postgres/query"],
      build: () => ({}),
    };

    // Type-level assertions
    type T1 = HasDefault<typeof withDefault>; // true
    type T2 = HasDefault<typeof withoutDefault>; // false
    const _t1: T1 = true;
    const _t2: T2 = false;

    expect(_t1).toBe(true);
    expect(_t2).toBe(false);
  });
});
```

**Step 3: Run test to verify it passes (compile-time test)**

Run: `cd packages/core && npx vitest run tests/defaults.test.ts`
Expected: PASS

**Step 4: Add `defaultInterpreter` to `PluginDefinition`**

In `packages/core/src/types.ts`, add the optional field to the interface:

```ts
export interface PluginDefinition<T = any, Traits extends Record<string, unknown> = {}> {
  name: string;
  nodeKinds: string[];
  build: (ctx: PluginContext) => T;
  defaultInterpreter?: Interpreter;  // NEW
  traits?: {
    eq?: TraitImpl;
    // ... existing fields
  };
}
```

This requires importing `Interpreter` from `./fold` in `types.ts`. Since `fold.ts` imports from `types.ts`, check for circular dependencies. If circular, use a forward-compatible approach: define a minimal type alias in `types.ts`:

```ts
/** Interpreter handler function type, used for defaultInterpreter field. */
type InterpreterHandler = (node: any) => AsyncGenerator<any, unknown, unknown>;
/** Runtime interpreter: maps node kind strings to async generator handlers. */
type InterpreterRecord = Record<string, InterpreterHandler>;
```

Then use `InterpreterRecord` instead of importing `Interpreter` from `fold.ts`.

**Step 5: Run build to check for circular deps**

Run: `cd packages/core && pnpm run build`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/core/src/types.ts packages/core/tests/defaults.test.ts
git commit -m "feat(core): add defaultInterpreter field to PluginDefinition (#207)"
```

---

### Task 2: Expose resolved plugins on `mvfm()` return value

**Files:**
- Modify: `packages/core/src/builder.ts:43-247`
- Modify: `packages/core/src/types.ts` (add `MvfmApp` type)

**Step 1: Write the failing test**

Add to `packages/core/tests/defaults.test.ts`:

```ts
import { mvfm, num, str } from "../src/core";

describe("mvfm() return value", () => {
  it("exposes .plugins array on the returned define function", () => {
    const app = mvfm(num, str);
    expect(app.plugins).toBeDefined();
    expect(Array.isArray(app.plugins)).toBe(true);
    expect(app.plugins.map((p) => p.name)).toEqual(["num", "str"]);
  });

  it("still works as a callable to define programs", () => {
    const app = mvfm(num, str);
    const prog = app(($) => $.sub(10, 3));
    expect(prog.ast).toBeDefined();
    expect(prog.hash).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/core && npx vitest run tests/defaults.test.ts`
Expected: FAIL — `app.plugins` is undefined (currently `app` is a plain function)

**Step 3: Implement — modify `mvfm()` to return callable with `.plugins`**

In `packages/core/src/builder.ts`, change the return from `return define;` to:

```ts
const app = Object.assign(define, {
  plugins: flattenPluginInputs(plugins),
});
return app;
```

Note: `flattenPluginInputs` is called once eagerly (not per-define call) since the plugin list is fixed at `mvfm()` time. For factory plugins, this means the factory is called once here and the resolved definitions are reused.

Wait — currently `flattenPluginInputs(plugins)` is called inside `define()`. For `.plugins` we need it outside. But we also need it inside `define()` for building. We should call it once outside and reuse:

```ts
export function mvfm<const P extends readonly PluginInput[]>(...plugins: P) {
  type FlatP = FlattenPluginInputs<P>;
  const resolvedPlugins = flattenPluginInputs(plugins);

  function define(/* ... */) {
    // Remove: const resolvedPlugins = flattenPluginInputs(plugins);
    // Use the outer resolvedPlugins instead
    // ... rest unchanged
  }

  return Object.assign(define, { plugins: resolvedPlugins });
}
```

**Important type consideration:** The return type of `mvfm()` changes. We need to add a type for it. In `types.ts`, add:

```ts
/** Return type of mvfm(): a callable define function with metadata. */
export interface MvfmApp<P extends readonly PluginInput[]> {
  <S extends SchemaShape>(
    schema: S,
    fn: ($: CoreDollar<InferSchema<S>> & MergePlugins<FlattenPluginInputs<P>>) => Expr<any> | any,
  ): Program;
  <I = never>(
    fn: ($: CoreDollar<I> & MergePlugins<FlattenPluginInputs<P>>) => Expr<any> | any,
  ): Program;
  readonly plugins: PluginDefinition[];
}
```

Update `builder.ts` return type annotation accordingly.

**Step 4: Run test to verify it passes**

Run: `cd packages/core && npx vitest run tests/defaults.test.ts`
Expected: PASS

**Step 5: Run full build + test suite to check nothing broke**

Run: `cd packages/core && pnpm run build && pnpm run test`
Expected: All tests PASS. Existing code calling `app(($) => ...)` still works because `Object.assign` preserves callability.

**Step 6: Commit**

```bash
git add packages/core/src/builder.ts packages/core/src/types.ts packages/core/tests/defaults.test.ts
git commit -m "feat(core): expose .plugins on mvfm() return value (#207)"
```

---

### Task 3: Implement `defaults()` function with type-safe overrides

**Files:**
- Create: `packages/core/src/defaults.ts`
- Modify: `packages/core/src/index.ts` (export defaults)
- Test: `packages/core/tests/defaults.test.ts`

**Step 1: Write the failing tests**

Add to `packages/core/tests/defaults.test.ts`:

```ts
import {
  coreInterpreter,
  foldAST,
  mvfm,
  num,
  str,
  numInterpreter,
  strInterpreter,
  defaults,
  prelude,
} from "../src/core";

describe("defaults()", () => {
  it("returns an interpreter with coreInterpreter + all plugin defaults", async () => {
    const app = mvfm(num, str);
    const interp = defaults(app);

    // Should have core handlers
    expect(interp["core/literal"]).toBeDefined();
    expect(interp["core/program"]).toBeDefined();

    // Should have num handlers
    expect(interp["num/add"]).toBeDefined();
    expect(interp["num/sub"]).toBeDefined();

    // Should have str handlers
    expect(interp["str/concat"]).toBeDefined();
  });

  it("can execute a program end-to-end", async () => {
    const app = mvfm(num, str);
    const prog = app(($) => $.sub(10, 3));
    const interp = defaults(app);
    const result = await foldAST(interp, prog.ast);
    expect(result).toBe(7);
  });

  it("accepts overrides that replace default interpreters", async () => {
    const app = mvfm(num);
    const mockNumInterpreter = {
      ...numInterpreter,
      "num/sub": async function* () {
        return 999;
      },
    };
    const interp = defaults(app, { num: mockNumInterpreter });
    const prog = app(($) => $.sub(10, 3));
    const result = await foldAST(interp, prog.ast);
    expect(result).toBe(999);
  });

  it("works with prelude (nested plugin array)", async () => {
    const app = mvfm(prelude);
    const interp = defaults(app);
    const prog = app(($) => $.add(1, 2));
    const result = await foldAST(interp, prog.ast);
    expect(result).toBe(3);
  });

  it("skips plugins with empty nodeKinds (typeclasses)", () => {
    const app = mvfm(prelude);
    const interp = defaults(app);
    // semiring has nodeKinds: [] — no handlers contributed
    // but num/add should still be there from num plugin
    expect(interp["num/add"]).toBeDefined();
  });

  it("throws at runtime when a plugin lacks both default and override", () => {
    const noDefaultPlugin = {
      name: "custom" as const,
      nodeKinds: ["custom/op"],
      build: () => ({}),
    };
    const app = mvfm(num, noDefaultPlugin);
    expect(() => defaults(app as any)).toThrow(/custom/);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/core && npx vitest run tests/defaults.test.ts`
Expected: FAIL — `defaults` is not exported

**Step 3: Implement `defaults()`**

Create `packages/core/src/defaults.ts`:

```ts
import { coreInterpreter } from "./interpreters/core";
import type { Interpreter } from "./fold";
import type { PluginDefinition, PluginInput } from "./types";

/**
 * Type-level helper: does a plugin have a default interpreter?
 * @internal
 */
type HasDefault<P> = P extends { defaultInterpreter: Interpreter } ? true : false;

/**
 * Extract plugins that need overrides (no defaultInterpreter field).
 * Skips plugins with empty nodeKinds (typeclasses).
 * @internal
 */
type PluginsNeedingOverride<Plugins extends readonly any[]> = {
  [K in keyof Plugins]: Plugins[K] extends { nodeKinds: readonly [] }
    ? never
    : HasDefault<Plugins[K]> extends true
      ? never
      : Plugins[K];
}[number];

/**
 * Extract the literal name type from plugins needing overrides.
 * @internal
 */
type OverrideKeys<Plugins extends readonly any[]> =
  PluginsNeedingOverride<Plugins> extends never
    ? never
    : PluginsNeedingOverride<Plugins> extends PluginDefinition
      ? PluginsNeedingOverride<Plugins>["name"]
      : never;

/**
 * Extract all plugin name literals.
 * @internal
 */
type AllPluginNames<Plugins extends readonly any[]> = {
  [K in keyof Plugins]: Plugins[K] extends PluginDefinition ? Plugins[K]["name"] : never;
}[number];

/**
 * Map of required overrides (for plugins without defaults) plus
 * optional overrides (for plugins with defaults).
 * @internal
 */
type OverridesMap<Plugins extends readonly any[]> = {
  [K in OverrideKeys<Plugins>]: Interpreter;
} & {
  [K in Exclude<AllPluginNames<Plugins>, OverrideKeys<Plugins>>]?: Interpreter;
};

/**
 * Conditional args: if no plugins need overrides, overrides is optional.
 * @internal
 */
type DefaultsArgs<Plugins extends readonly any[]> =
  OverrideKeys<Plugins> extends never
    ? [overrides?: Partial<Record<AllPluginNames<Plugins>, Interpreter>>]
    : [overrides: OverridesMap<Plugins>];

/**
 * The shape of the object returned by mvfm() — a callable with .plugins.
 * @internal
 */
interface MvfmAppLike {
  readonly plugins: PluginDefinition[];
}

/**
 * Derive a complete interpreter from an mvfm app's plugin list.
 *
 * Collects `defaultInterpreter` from each plugin and spreads
 * `coreInterpreter` as the base. Plugins without defaults must
 * be provided via the overrides map.
 *
 * @param app - The return value of `mvfm(...)`.
 * @param overrides - Interpreter overrides keyed by plugin name.
 * @returns A complete `Interpreter` ready for `foldAST`.
 *
 * @example
 * ```ts
 * const app = mvfm(prelude, console_);
 * const interpreter = defaults(app);
 * ```
 *
 * @example
 * ```ts
 * const app = mvfm(prelude, postgres(url));
 * const interpreter = defaults(app, { postgres: pgInterpreter });
 * ```
 */
export function defaults<A extends MvfmAppLike>(
  app: A,
  ...args: A extends { readonly plugins: infer Plugins extends readonly any[] }
    ? DefaultsArgs<Plugins>
    : [overrides?: Record<string, Interpreter>]
): Interpreter {
  const overrides = (args[0] ?? {}) as Record<string, Interpreter>;
  const result: Interpreter = { ...coreInterpreter };

  for (const plugin of app.plugins) {
    if (plugin.nodeKinds.length === 0) continue;

    const override = overrides[plugin.name];
    if (override) {
      Object.assign(result, override);
      continue;
    }

    if (plugin.defaultInterpreter) {
      Object.assign(result, plugin.defaultInterpreter);
      continue;
    }

    throw new Error(
      `defaults(): plugin "${plugin.name}" has no default interpreter and no override was provided. ` +
        `Pass { ${plugin.name}: yourInterpreter } in the overrides map.`,
    );
  }

  return result;
}
```

**Step 4: Export from `packages/core/src/index.ts`**

Add: `export { defaults } from "./defaults";`

**Step 5: Run test to verify it passes**

Run: `cd packages/core && npx vitest run tests/defaults.test.ts`
Expected: PASS

**Step 6: Run full build + tests**

Run: `cd packages/core && pnpm run build && pnpm run test`
Expected: All PASS

**Step 7: Commit**

```bash
git add packages/core/src/defaults.ts packages/core/src/index.ts packages/core/tests/defaults.test.ts
git commit -m "feat(core): implement defaults() with type-safe overrides (#207)"
```

---

### Task 4: Add `defaultInterpreter` to core plugins

**Files:**
- Modify: `packages/core/src/plugins/num/index.ts`
- Modify: `packages/core/src/plugins/str/index.ts`
- Modify: `packages/core/src/plugins/boolean/index.ts`
- Modify: `packages/core/src/plugins/eq/index.ts`
- Modify: `packages/core/src/plugins/ord/index.ts`
- Modify: `packages/core/src/plugins/error/index.ts`
- Modify: `packages/core/src/plugins/fiber/index.ts`

**Step 1: Write the failing test**

Add to `packages/core/tests/defaults.test.ts`:

```ts
import { boolean, eq, num, ord, str } from "../src/core";

describe("core plugins have defaultInterpreter", () => {
  it.each([
    ["num", num],
    ["str", str],
    ["boolean", boolean],
    ["eq", eq],
    ["ord", ord],
  ])("%s has defaultInterpreter", (name, plugin) => {
    expect(plugin.defaultInterpreter).toBeDefined();
    expect(typeof plugin.defaultInterpreter).toBe("object");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/core && npx vitest run tests/defaults.test.ts`
Expected: FAIL — `defaultInterpreter` is undefined on these plugins

**Step 3: Add `defaultInterpreter` to each core plugin**

For each plugin, import its interpreter and add the field. Example for num:

In `packages/core/src/plugins/num/index.ts`, add:

```ts
import { numInterpreter } from "./interpreter";
```

And add to the plugin definition object:

```ts
defaultInterpreter: numInterpreter,
```

Repeat for: str (strInterpreter), boolean (booleanInterpreter), eq (eqInterpreter), ord (ordInterpreter).

For error and fiber plugins: these are not in prelude but have interpreters. Add defaultInterpreter to them too for completeness.

**Step 4: Run test to verify it passes**

Run: `cd packages/core && npx vitest run tests/defaults.test.ts`
Expected: PASS

**Step 5: Run full build + tests**

Run: `cd packages/core && pnpm run build && pnpm run test`
Expected: All PASS

**Step 6: Commit**

```bash
git add packages/core/src/plugins/*/index.ts
git commit -m "feat(core): add defaultInterpreter to core plugins (#207)"
```

---

### Task 5: Add `defaultInterpreter` to external plugins

**Files:**
- Modify: `packages/plugin-console/src/22.0.0/index.ts`
- Modify: `packages/plugin-fetch/src/whatwg/index.ts` (or wherever the PluginDefinition is)
- Modify: similarly for all external plugins with defaults (anthropic, fal, openai, pino, resend, slack, stripe, twilio)

For each external plugin that already has a `*Interpreter` const:

**Step 1: Write the failing test**

In the plugin's test file, add:

```ts
it("plugin definition has defaultInterpreter", () => {
  const plugin = consolePlugin(); // or the factory call
  expect(plugin.defaultInterpreter).toBeDefined();
});
```

**Step 2: Run test to verify it fails**

Run from the plugin package: `npx vitest run tests/<version>/interpreter.test.ts`
Expected: FAIL

**Step 3: Add `defaultInterpreter` to the factory return**

For factory plugins like console, add the field to the returned object:

```ts
import { consoleInterpreter } from "./interpreter";

export function console(config: ConsoleConfig = {}): PluginDefinition<ConsoleMethods> {
  return {
    name: "console",
    nodeKinds,
    defaultInterpreter: consoleInterpreter,  // NEW
    build(ctx) { /* ... */ },
  };
}
```

**Important:** This means the default interpreter is eagerly loaded when the factory is called. For env-dependent plugins (stripe, slack, etc.) that use `lazyInterpreter()`, the default is lazy — it won't fail until actually used. This is fine.

Repeat for each of the 10 external plugins with defaults: anthropic, console, fal, fetch, openai, pino, resend, slack, stripe, twilio.

**Step 4: Run tests to verify they pass**

Run: `pnpm run test` from repo root (or per-package)
Expected: All PASS

**Step 5: Commit**

```bash
git add packages/plugin-*/src/*/index.ts packages/plugin-*/src/*/interpreter.ts
git commit -m "feat(plugins): add defaultInterpreter to external plugins (#207)"
```

---

### Task 6: End-to-end integration test

**Files:**
- Add to: `packages/core/tests/defaults.test.ts`

**Step 1: Write the integration test**

```ts
describe("defaults() end-to-end", () => {
  it("full prelude program: add, compare, show", async () => {
    const app = mvfm(prelude);
    const prog = app(($) => $.show($.add(1, 2)));
    const interp = defaults(app);
    const result = await foldAST(interp, prog.ast);
    expect(result).toBe("3");
  });

  it("works with injectInput", async () => {
    const { injectInput } = await import("../src/core");
    const app = mvfm(num, str);
    const prog = app({ n: "number" }, ($) => $.sub($.input.n, 1));
    const interp = defaults(app);
    const ast = injectInput(prog.ast, { n: 10 });
    const result = await foldAST(interp, ast.result);
    expect(result).toBe(9);
  });
});
```

**Step 2: Run test**

Run: `cd packages/core && npx vitest run tests/defaults.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/core/tests/defaults.test.ts
git commit -m "test(core): add end-to-end integration tests for defaults() (#207)"
```

---

### Task 7: Export `MvfmApp` type and update API surface

**Files:**
- Modify: `packages/core/src/index.ts`
- Run: `cd packages/core && pnpm run check` (includes api-extractor)

**Step 1: Add `MvfmApp` to exports in `packages/core/src/index.ts`**

```ts
export type { MvfmApp } from "./types"; // or wherever it ends up
```

**Step 2: Run check to update API report**

Run: `cd packages/core && pnpm run check`

If api-extractor reports changes, update the `.api.md` file:
Run: `cd packages/core && npx api-extractor run --local`

**Step 3: Run full validation**

Run: `pnpm run build && pnpm run check && pnpm run test` from repo root
Expected: All PASS

**Step 4: Commit**

```bash
git add packages/core/src/index.ts packages/core/etc/
git commit -m "feat(core): export MvfmApp type and update API surface (#207)"
```

---

### Task 8: Final validation

**Step 1: Full repo build + check + test**

Run from repo root:
```bash
pnpm run build && pnpm run check && pnpm run test
```

Expected: All PASS across all packages.

**Step 2: Verify no files exceed 300 lines**

Check `packages/core/src/defaults.ts` and `packages/core/tests/defaults.test.ts` are under 300 lines.

**Step 3: Verify all new exports have TSDoc comments**

Check that `defaults`, `MvfmApp`, and the `defaultInterpreter` field all have TSDoc.
