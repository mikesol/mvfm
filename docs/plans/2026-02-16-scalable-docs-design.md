# Scalable Documentation Site Design

**Date:** 2026-02-16
**Issue:** #6 (Umbrella: Kapoor-style documentation site)
**Status:** Design approved

## Problem

The docs site has 2 hand-written pages and a hardcoded home page. There are 15 plugins with 261+ node kinds. We need:

1. **No copy-paste** — adding a node kind's docs should be adding one entry, not cloning a file
2. **Infra plugins work** — postgres, stripe, etc. run against mock interpreters in the browser
3. **CI enforcement** — a new node kind without docs = red CI
4. **Escape hatch** — ~5% of pages may need custom layouts (easter eggs, extra sections)

## Architecture

### Examples Registry

Each plugin gets one file in `packages/docs/src/examples/`:

```
examples/
  index.ts          ← re-exports all, provides getAllExamples()
  types.ts          ← NodeExample interface
  core.ts
  console.ts
  postgres.ts
  zod.ts
  ...
```

Each file exports a record keyed by node kind:

```ts
import type { NodeExample } from "./types";

export default {
  "core/begin": {
    description: "Sequential composition. Evaluates each argument in order, returns the last.",
    code: `const app = mvfm(prelude, console_);
const prog = app({ n: "number" }, ($) => {
  return $.begin(
    $.console.log($.input.n),
    $.add($.input.n, 1)
  );
});
await foldAST(defaults(app), injectInput(prog, { n: 42 }));`,
  },
} satisfies Record<string, NodeExample>;
```

The `NodeExample` type:

```ts
interface NodeExample {
  description: string;
  code: string;
  plugins?: string[];       // which plugins to import (defaults to ["core", "console"])
  mockInterpreter?: string; // inline JS for mock interpreter (infra plugins)
}
```

The `getAllExamples()` aggregator:

```ts
import core from "./core";
import console_ from "./console";
// ...

export function getAllExamples(): Record<string, NodeExample> {
  return { ...core, ...console_, /* ... */ };
}
```

### Dynamic Route

Single template at `packages/docs/src/pages/[...slug].astro`:

```astro
---
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

### Auto-Generated Home Page

`packages/docs/src/pages/index.astro`:

```astro
---
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

No hardcoded links. Add an example entry → it appears on the home page automatically.

### Escape Hatch (Custom Pages)

Astro routes static files before dynamic routes. To customize a specific page:

1. Create `packages/docs/src/pages/core/begin.astro`
2. Import the same components (`Base`, `Playground`)
3. Compose however you want — extra sections, second playground, easter eggs

The `[...slug].astro` dynamic route skips any kind that has a static file. No configuration needed.

### Shared Playground Scope

Extract the injected scope into a shared function used by both the browser Playground and the test runner:

```ts
// packages/docs/src/playground-scope.ts
export async function createPlaygroundScope(
  console: any,
  mockInterpreter?: Record<string, Function>,
) {
  const core = await import("@mvfm/core");
  const pluginConsole = await import("@mvfm/plugin-console");
  const { console: _drop, consoleInterpreter: _defaultInterp, ...consoleRest } = pluginConsole;
  const fakeConsoleInterpreter = pluginConsole.createConsoleInterpreter(
    pluginConsole.wrapConsole(console),
  );
  const realDefaults = core.defaults;
  const injected = {
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
    paramValues: [console, ...Object.values(injected)],
  };
}
```

Consumed by:
- `Playground.tsx` (browser, captures console output to UI)
- `examples.test.ts` (Node, validates examples execute without error)

### CI Enforcement

Two checks, both running in CI:

**1. Coverage check** (`scripts/check-docs-coverage.ts`):

```ts
// Import every plugin, collect all nodeKinds
// Import getAllExamples(), collect all documented kinds
// Diff: missing = allKinds - documented
// Exit 1 if missing.length > 0
```

**2. Execution check** (`packages/docs/tests/examples.test.ts`):

```ts
import { describe, it, expect } from "vitest";
import { getAllExamples } from "../src/examples";
import { createPlaygroundScope } from "../src/playground-scope";

const examples = getAllExamples();

describe("docs examples", () => {
  for (const [kind, example] of Object.entries(examples)) {
    it(`${kind} runs without error`, async () => {
      const logs: string[] = [];
      const fakeConsole = { log: (...args: any[]) => logs.push(args.join(" ")) };

      // Parse mockInterpreter if provided
      const mock = example.mockInterpreter
        ? new Function(`return (${example.mockInterpreter})`)()
        : undefined;

      const { paramNames, paramValues } = await createPlaygroundScope(fakeConsole, mock);
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      const fn = new AsyncFunction(...paramNames, example.code);
      await fn(...paramValues);
    });
  }
});
```

Wired into CI:
- Add `"check:docs": "tsx scripts/check-docs-coverage.ts"` to root scripts
- Add `"test"` script to `packages/docs/package.json` running vitest
- Add both to `.github/workflows/ci.yml`

### Plugin Authoring Guide Update

Add one rule to `docs/plugin-authoring-guide.md`:

> **Every node kind must have a docs example.** Add an entry to the corresponding file in `packages/docs/src/examples/`. CI will fail if any node kind in your plugin's `nodeKinds` array lacks an example. For plugins requiring infrastructure, provide a `mockInterpreter` that returns realistic fake data.

## File Structure (Final)

```
packages/docs/
  src/
    components/
      Playground.tsx          ← existing, uses createPlaygroundScope
    examples/
      index.ts                ← getAllExamples() aggregator
      types.ts                ← NodeExample interface
      core.ts                 ← examples for core/* node kinds
      console.ts              ← examples for console/* node kinds
      postgres.ts             ← examples for postgres/* (with mockInterpreter)
      zod.ts                  ← examples for zod/* node kinds
      ...                     ← one file per plugin
    layouts/
      Base.astro              ← existing
    pages/
      index.astro             ← auto-generated home page
      [...slug].astro         ← dynamic route template
      core/begin.astro        ← (optional) custom escape-hatch page
    playground-scope.ts       ← shared injected scope
    styles/
      global.css              ← existing
  tests/
    examples.test.ts          ← execution check
scripts/
  check-docs-coverage.ts      ← coverage check
```

## What This Doesn't Cover (Explicitly Deferred)

- **TypeScript type checking in the playground** — Monaco/squigglies, future enhancement
- **AST visualization** — showing the tree structure, potential future feature
- **Pirouettes** — tree rewrites, optimizers (Issue #6 mentions "below fold" surprises)
- **Versioned docs** — docs track main, no version switcher
- **Search** — Kapoor aesthetic has no search bar, scroll or leave
