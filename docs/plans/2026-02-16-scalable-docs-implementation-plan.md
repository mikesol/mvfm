# Scalable Documentation Site Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the examples registry, dynamic routing, shared playground scope, and CI enforcement for the MVFM docs site — covering all core plugin node kinds plus one infra plugin (postgres) as proof of mock interpreters.

**Architecture:** Astro dynamic routes render pages from an examples registry (one .ts file per plugin). A shared `createPlaygroundScope()` powers both the browser Playground and a vitest execution check. A coverage script fails CI if any plugin nodeKind lacks a docs example.

**Tech Stack:** Astro 5, React 19, Vitest, TypeScript, Shiki

---

### Task 1: NodeExample Type + Examples Index

**Files:**
- Create: `packages/docs/src/examples/types.ts`
- Create: `packages/docs/src/examples/index.ts`

**Step 1: Create the NodeExample type**

```ts
// packages/docs/src/examples/types.ts
export interface NodeExample {
  /** One-line description shown below the heading. */
  description: string;
  /** Executable code for the playground. */
  code: string;
  /** Plugin packages to import beyond core+console. Defaults to none. */
  plugins?: string[];
  /** JS expression returning an interpreter record for infra plugins. */
  mockInterpreter?: string;
}
```

**Step 2: Create the index aggregator (empty for now)**

```ts
// packages/docs/src/examples/index.ts
import type { NodeExample } from "./types";

// Plugin example files will be added here as they're created
const modules: Record<string, NodeExample>[] = [];

export function getAllExamples(): Record<string, NodeExample> {
  return Object.assign({}, ...modules);
}
```

**Step 3: Commit**

```bash
git add packages/docs/src/examples/
git commit -m "docs: add NodeExample type and examples index"
```

---

### Task 2: Migrate core/begin and core/cond into Registry

**Files:**
- Create: `packages/docs/src/examples/core.ts`
- Modify: `packages/docs/src/examples/index.ts`
- Delete: `packages/docs/src/pages/core/begin.astro`
- Delete: `packages/docs/src/pages/core/cond.astro`

**Step 1: Create core examples file with the two existing examples**

```ts
// packages/docs/src/examples/core.ts
import type { NodeExample } from "./types";

const examples: Record<string, NodeExample> = {
  "core/begin": {
    description: "Sequential composition. Evaluates each argument in order, returns the last.",
    code: `// 1. make an app
const app = mvfm(prelude, console_);

// 2. make a program
const prog = app({ n: "number", name: "string" }, ($) => {
  const total = $.add($.input.n, 2);
  const greeting = $.concat($.input.name, " world");
  return $.begin(
    $.console.log(total),
    $.console.log(greeting),
    greeting
  );
});

// 3. run
await foldAST(
  defaults(app),
  injectInput(prog, { n: 40, name: "hello" })
);`,
  },
  "core/cond": {
    description: "Conditional branching. .t() for then, .f() for else. Either order.",
    code: `// 1. make an app
const app = mvfm(prelude, console_);

// 2. make a program
const prog = app({ x: "number" }, ($) => {
  const total = $.add($.input.x, 1);
  const big = $.gt(total, 100);
  return $.begin(
    $.console.log(
      $.cond(big)
        .t($.concat("big: ", $.show(total)))
        .f("small")
    ),
    total
  );
});

// 3. run
await foldAST(
  defaults(app),
  injectInput(prog, { x: 250 })
);`,
  },
};

export default examples;
```

**Step 2: Wire into index**

Update `packages/docs/src/examples/index.ts`:

```ts
import type { NodeExample } from "./types";
import core from "./core";

const modules: Record<string, NodeExample>[] = [core];

export function getAllExamples(): Record<string, NodeExample> {
  return Object.assign({}, ...modules);
}
```

**Step 3: Delete old static pages**

```bash
rm packages/docs/src/pages/core/begin.astro
rm packages/docs/src/pages/core/cond.astro
rmdir packages/docs/src/pages/core  # if empty
```

**Step 4: Commit**

```bash
git add -A packages/docs/src/examples/ packages/docs/src/pages/core/
git commit -m "docs: migrate begin and cond examples to registry"
```

---

### Task 3: Dynamic Route Template

**Files:**
- Create: `packages/docs/src/pages/[...slug].astro`
- Modify: `packages/docs/src/pages/index.astro`

**Step 1: Create the dynamic route**

```astro
---
// packages/docs/src/pages/[...slug].astro
import Base from "../layouts/Base.astro";
import Playground from "../components/Playground";
import { getAllExamples } from "../examples";

export function getStaticPaths() {
  const examples = getAllExamples();
  return Object.entries(examples).map(([kind, example]) => ({
    params: { slug: kind },
    props: { kind, ...example },
  }));
}

const { kind, description, code } = Astro.props;
---

<Base title={`${kind} — MVFM`}>
  <div class="pt-4">
    <h1 class="text-2xl font-bold text-base-50 tracking-tight">{kind}</h1>
    <p class="mt-2 text-base text-base-500">{description}</p>
    <Playground code={code} client:visible />
  </div>
</Base>
```

**Step 2: Update index.astro to auto-generate links**

```astro
---
// packages/docs/src/pages/index.astro
import Base from "../layouts/Base.astro";
import { getAllExamples } from "../examples";

const kinds = Object.keys(getAllExamples()).sort();
---

<Base>
  <div class="pt-16 text-lg leading-loose">
    {kinds.map((kind) => (
      <a href={`/${kind}`} class="text-base-500 hover:text-base-50 transition-colors">{kind}</a>
    ))}
  </div>
</Base>
```

**Step 3: Verify in browser**

Run `pnpm --filter @mvfm/docs run dev` and check:
- `http://localhost:4323/` shows sorted list of core/begin, core/cond
- `http://localhost:4323/core/begin` renders correctly
- `http://localhost:4323/core/cond` renders correctly
- Both playgrounds work (click RUN, see output)

**Step 4: Commit**

```bash
git add packages/docs/src/pages/
git commit -m "docs: dynamic route template and auto-generated home page"
```

---

### Task 4: Shared Playground Scope

**Files:**
- Create: `packages/docs/src/playground-scope.ts`
- Modify: `packages/docs/src/components/Playground.tsx` (refactor to use shared scope)

**Step 1: Extract playground scope**

```ts
// packages/docs/src/playground-scope.ts
export async function createPlaygroundScope(
  fakeConsole: { log: (...args: unknown[]) => void },
  mockInterpreter?: Record<string, unknown>,
) {
  const core = await import("@mvfm/core");
  const pluginConsole = await import("@mvfm/plugin-console");
  const {
    console: _drop,
    consoleInterpreter: _defaultInterp,
    ...consoleRest
  } = pluginConsole;
  const fakeConsoleInterpreter = pluginConsole.createConsoleInterpreter(
    pluginConsole.wrapConsole(fakeConsole as any),
  );
  const realDefaults = core.defaults;
  const injected: Record<string, unknown> = {
    ...core,
    console_: pluginConsole.consolePlugin(),
    ...consoleRest,
    consoleInterpreter: fakeConsoleInterpreter,
    defaults: (app: any, ...args: any[]) => {
      const interp = realDefaults(app, ...args);
      Object.assign(interp, fakeConsoleInterpreter);
      if (mockInterpreter) Object.assign(interp, mockInterpreter);
      return interp;
    },
  };
  return {
    paramNames: ["console", ...Object.keys(injected)],
    paramValues: [fakeConsole, ...Object.values(injected)],
  };
}
```

**Step 2: Refactor Playground.tsx to use createPlaygroundScope**

Replace the `try` block inside `run` with:

```tsx
const { paramNames, paramValues } = await createPlaygroundScope(fakeConsole);
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const fn = new AsyncFunction(...paramNames, code);
await fn(...paramValues);
```

Remove the inline `core`, `pluginConsole`, `injected` construction — it's now in `playground-scope.ts`.

**Step 3: Verify in browser**

Reload dev server, run both examples, confirm output is unchanged.

**Step 4: Commit**

```bash
git add packages/docs/src/playground-scope.ts packages/docs/src/components/Playground.tsx
git commit -m "refactor: extract shared playground scope"
```

---

### Task 5: Add Remaining Core Node Kind Examples

**Files:**
- Modify: `packages/docs/src/examples/core.ts`

**Step 1: Add examples for all user-facing core/* node kinds**

The user-facing core node kinds are: `core/begin` (done), `core/cond` (done), `core/literal`, `core/input`, `core/record`, `core/tuple`.

Internal kinds to skip (no user-facing docs): `core/program`, `core/prop_access`, `core/lambda_param`, `core/lambda`, `core/method_call`, `core/rec`, `core/rec_call`.

Add entries for the 4 remaining user-facing core kinds to `core.ts`.

**Step 2: Verify in browser**

Check each new page loads and its example runs.

**Step 3: Commit**

```bash
git add packages/docs/src/examples/core.ts
git commit -m "docs: add examples for all user-facing core node kinds"
```

---

### Task 6: Add Plugin Example Files (boolean, num, str, ord, eq)

**Files:**
- Create: `packages/docs/src/examples/boolean.ts`
- Create: `packages/docs/src/examples/num.ts`
- Create: `packages/docs/src/examples/str.ts`
- Create: `packages/docs/src/examples/ord.ts`
- Create: `packages/docs/src/examples/eq.ts`
- Modify: `packages/docs/src/examples/index.ts` (add imports)

**Step 1: Create example files**

Each file exports a `Record<string, NodeExample>` covering all nodeKinds for that plugin. Examples should use `$.input` to show real operations, not toy literals.

Node kinds per plugin:
- **boolean**: `boolean/and`, `boolean/or`, `boolean/not`, `boolean/eq`, `boolean/ff`, `boolean/tt`, `boolean/implies`, `boolean/show`, `boolean/top`, `boolean/bottom`
- **num**: `num/add`, `num/sub`, `num/mul`, `num/div`, `num/mod`, `num/compare`, `num/neg`, `num/abs`, `num/floor`, `num/ceil`, `num/round`, `num/min`, `num/max`, `num/eq`, `num/zero`, `num/one`, `num/show`, `num/top`, `num/bottom`
- **str**: `str/template`, `str/concat`, `str/upper`, `str/lower`, `str/trim`, `str/slice`, `str/includes`, `str/startsWith`, `str/endsWith`, `str/split`, `str/join`, `str/replace`, `str/len`, `str/eq`, `str/show`, `str/append`, `str/mempty`
- **ord**: `ord/gt`, `ord/gte`, `ord/lt`, `ord/lte`
- **eq**: `eq/neq`

**Step 2: Wire all into index.ts**

Add imports and add to `modules` array.

**Step 3: Verify in browser**

Home page should now list all these node kinds. Spot-check several pages.

**Step 4: Commit**

```bash
git add packages/docs/src/examples/
git commit -m "docs: add examples for boolean, num, str, ord, eq plugins"
```

---

### Task 7: Add Plugin Example Files (st, control, error, fiber)

**Files:**
- Create: `packages/docs/src/examples/st.ts`
- Create: `packages/docs/src/examples/control.ts`
- Create: `packages/docs/src/examples/error.ts`
- Create: `packages/docs/src/examples/fiber.ts`
- Modify: `packages/docs/src/examples/index.ts`

**Step 1: Create example files**

Node kinds:
- **st**: `st/let`, `st/get`, `st/set`, `st/push`
- **control**: `control/each`, `control/while`
- **error**: `error/try`, `error/fail`, `error/attempt`, `error/guard`, `error/settle`
- **fiber**: `fiber/par_map`, `fiber/race`, `fiber/timeout`, `fiber/retry`

**Step 2: Wire into index.ts, verify, commit**

```bash
git add packages/docs/src/examples/
git commit -m "docs: add examples for st, control, error, fiber plugins"
```

---

### Task 8: Add Console Plugin Examples

**Files:**
- Create: `packages/docs/src/examples/console.ts`
- Modify: `packages/docs/src/examples/index.ts`

**Step 1: Create console examples**

Node kinds: `console/log`, `console/error`, `console/warn`, `console/info`, `console/debug`, `console/assert`, `console/clear`, `console/count`, `console/countReset`, `console/dir`, `console/dirxml`, `console/group`, `console/groupCollapsed`, `console/groupEnd`, `console/table`, `console/time`, `console/timeEnd`, `console/timeLog`, `console/trace`

Many of these are similar — keep examples short and focused.

**Step 2: Wire, verify, commit**

```bash
git add packages/docs/src/examples/
git commit -m "docs: add examples for console plugin"
```

---

### Task 9: Add Postgres Plugin Examples (Mock Interpreter Proof)

**Files:**
- Create: `packages/docs/src/examples/postgres.ts`
- Modify: `packages/docs/src/examples/index.ts`
- Modify: `packages/docs/src/playground-scope.ts` (if needed for mock support)
- Modify: `packages/docs/src/components/Playground.tsx` (if needed to accept mockInterpreter prop)

**Step 1: Create postgres examples with mock interpreters**

Node kinds: `postgres/query`, `postgres/identifier`, `postgres/insert_helper`, `postgres/set_helper`, `postgres/begin`, `postgres/savepoint`, `postgres/cursor`, `postgres/cursor_batch`

Each example needs a `mockInterpreter` that returns realistic fake data. For example:

```ts
"postgres/query": {
  description: "Execute a SQL query and return rows.",
  plugins: ["postgres"],
  code: `const app = mvfm(prelude, console_, postgres());
const prog = app({ table: "string" }, ($) => {
  const result = $.postgres.query($.concat("SELECT * FROM ", $.input.table));
  return $.begin(
    $.console.log(result),
    result
  );
});
await foldAST(
  defaults(app),
  injectInput(prog, { table: "users" })
);`,
  mockInterpreter: `{
    "postgres/query": async function* (node) {
      return { rows: [{ id: 1, name: "alice" }, { id: 2, name: "bob" }], rowCount: 2 };
    }
  }`,
}
```

**Step 2: Update Playground.tsx to support mockInterpreter prop**

The Playground component needs to accept an optional `mockInterpreter` string prop, parse it, and pass it to `createPlaygroundScope`.

**Step 3: Update `[...slug].astro` to pass mockInterpreter prop**

```astro
const { kind, description, code, mockInterpreter } = Astro.props;
...
<Playground code={code} mockInterpreter={mockInterpreter} client:visible />
```

**Step 4: Verify postgres pages render and RUN produces mock output**

**Step 5: Commit**

```bash
git add packages/docs/src/
git commit -m "docs: add postgres examples with mock interpreters"
```

---

### Task 10: Vitest Execution Check

**Files:**
- Create: `packages/docs/tests/examples.test.ts`
- Modify: `packages/docs/package.json` (add test script)

**Step 1: Create the test**

```ts
// packages/docs/tests/examples.test.ts
import { describe, it } from "vitest";
import { getAllExamples } from "../src/examples";
import { createPlaygroundScope } from "../src/playground-scope";

const examples = getAllExamples();

describe("docs examples", () => {
  for (const [kind, example] of Object.entries(examples)) {
    it(`${kind} runs without error`, async () => {
      const logs: string[] = [];
      const fakeConsole = {
        log: (...args: unknown[]) => logs.push(args.map(String).join(" ")),
      };

      const mock = example.mockInterpreter
        ? new Function(`return (${example.mockInterpreter})`)()
        : undefined;

      const { paramNames, paramValues } = await createPlaygroundScope(
        fakeConsole,
        mock,
      );
      const AsyncFunction = Object.getPrototypeOf(
        async function () {},
      ).constructor;
      const fn = new AsyncFunction(...paramNames, example.code);
      await fn(...paramValues);
    });
  }
});
```

**Step 2: Add test script to docs package.json**

Add `"test": "vitest run"` to `packages/docs/package.json` scripts.

**Step 3: Run tests**

```bash
pnpm --filter @mvfm/docs run test
```

Expected: All examples pass.

**Step 4: Commit**

```bash
git add packages/docs/tests/ packages/docs/package.json
git commit -m "test: add execution check for all docs examples"
```

---

### Task 11: Coverage Check Script

**Files:**
- Create: `scripts/check-docs-coverage.ts`
- Modify: root `package.json` (add `check:docs` script)

**Step 1: Create the coverage check**

```ts
// scripts/check-docs-coverage.ts
import { getAllExamples } from "../packages/docs/src/examples/index.js";

// Import all plugins and collect nodeKinds
// Core plugins
import { prelude } from "../packages/core/src/index.js";
// ... or dynamically discover from plugin definitions

// Collect all documented kinds
const documented = new Set(Object.keys(getAllExamples()));

// Collect all nodeKinds from plugins
// This needs to import each plugin and read its nodeKinds
// The exact approach depends on how plugins export their definitions

// For now: read plugin definitions programmatically
const allKinds = new Set<string>();
// ... populate from plugin imports

const missing = [...allKinds].filter((k) => !documented.has(k));

if (missing.length > 0) {
  console.error(`Missing docs for ${missing.length} node kind(s):`);
  for (const k of missing) console.error(`  - ${k}`);
  process.exit(1);
}

console.log(`All ${allKinds.size} node kinds documented.`);
```

Note: The exact import paths for all plugins need to be discovered during implementation. The script must import every plugin definition and union their `nodeKinds` arrays. Some node kinds are internal (e.g., `core/program`, `core/prop_access`, `core/lambda_param`, `core/lambda`, `core/method_call`, `core/rec`, `core/rec_call`) and should be excluded via an `INTERNAL_KINDS` set.

**Step 2: Add to root package.json**

Add `"check:docs": "tsx scripts/check-docs-coverage.ts"` to scripts.

**Step 3: Run and verify**

```bash
pnpm run check:docs
```

Expected: Pass (all documented) or fail (lists missing kinds).

**Step 4: Commit**

```bash
git add scripts/check-docs-coverage.ts package.json
git commit -m "ci: add docs coverage check script"
```

---

### Task 12: Wire into CI

**Files:**
- Modify: `.github/workflows/ci.yml`

**Step 1: Add docs checks to CI**

Add after the existing `test` step:

```yaml
- name: Check docs coverage
  run: pnpm run check:docs
- name: Test docs examples
  run: pnpm --filter @mvfm/docs run test
```

**Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add docs coverage and example execution checks"
```

---

### Task 13: Update Plugin Authoring Guide

**Files:**
- Modify: `docs/plugin-authoring-guide.md`

**Step 1: Add docs requirement**

Add a new section or rule:

> **Every node kind must have a docs example.** When you add a node kind to your plugin's `nodeKinds` array, add a corresponding entry in `packages/docs/src/examples/<plugin-name>.ts`. CI will fail if any node kind lacks an example. For plugins requiring infrastructure, provide a `mockInterpreter` that returns realistic fake data. See `packages/docs/src/examples/postgres.ts` for the pattern.

**Step 2: Commit**

```bash
git add docs/plugin-authoring-guide.md
git commit -m "docs: add example requirement to plugin authoring guide"
```

---

### Task 14: Review and Update Downstream Issues

**Files:** None (GitHub issue management only)

**Step 1: Update issue #181 (spike)**

Comment that the spike is effectively complete — we have two working pages with interactive playgrounds, syntax highlighting, and error reporting.

**Step 2: Update issue #182 (build system)**

Comment or close — the registry + dynamic routes + CI enforcement covers this issue's scope.

**Step 3: Update issue #183 (full build-out)**

Update description to reflect the new approach: remaining work is adding example entries per plugin. List which plugins still need examples after this PR (all external plugins except postgres).

**Step 4: Create issues for remaining plugin docs**

Create one issue per remaining external plugin group that needs docs examples:
- Zod plugin examples
- Anthropic + OpenAI plugin examples
- Fetch plugin examples
- Slack + Twilio + Resend plugin examples
- Stripe plugin examples
- S3 + Cloudflare KV plugin examples
- Pino plugin examples
- Fal plugin examples

Each issue should reference the pattern established in this PR and note that mock interpreters are required.

**Step 5: Update issue #221 (plugin authoring guide)**

Note that the docs requirement was added as part of this work.
