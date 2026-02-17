# Namespace Index Pages Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add landing pages for each plugin namespace (`/core`, `/postgres`, `/num`, etc.) that introduce each plugin before users dive into individual node kinds.

**Architecture:** New `NamespaceIndex` type unioned with `NodeExample` in the same registry. Index entries keyed by bare namespace (no slash). The existing `[...slug].astro` route branches rendering by entry type. A dedicated `indexes.ts` file holds all index page content as HTML strings.

**Tech Stack:** Astro, TypeScript, existing Shiki `<Code>` component for static code blocks.

**Design doc:** `docs/plans/2026-02-17-issue-256-namespace-index-pages-design.md`

---

### Task 1: Add NamespaceIndex type and type guard

**Files:**
- Modify: `packages/docs/src/examples/types.ts`

**Step 1: Add the new types**

Add after the existing `NodeExample` interface:

```typescript
/** Prose landing page for a plugin namespace (e.g. /core, /postgres). */
export interface NamespaceIndex {
  /** Prose content as raw HTML. */
  content: string;
  /** Optional non-runnable code example (rendered with Shiki Code component). */
  staticCode?: string;
}

/** Union of all example entry types. */
export type ExampleEntry = NodeExample | NamespaceIndex;

/** Type guard: true when the entry is a namespace index page, not a runnable example. */
export function isNamespaceIndex(
  entry: ExampleEntry,
): entry is NamespaceIndex {
  return "content" in entry && !("code" in entry);
}
```

**Step 2: Commit**

```bash
git add packages/docs/src/examples/types.ts
git commit -m "feat(docs): add NamespaceIndex type and type guard"
```

---

### Task 2: Create indexes.ts with all 13 namespace index entries

**Files:**
- Create: `packages/docs/src/examples/indexes.ts`

**Step 1: Create the file**

Create `packages/docs/src/examples/indexes.ts` with a default export of `Record<string, NamespaceIndex>`. The keys are bare namespace names (no slash): `core`, `boolean`, `num`, `str`, `eq`, `ord`, `st`, `control`, `error`, `fiber`, `console`, `postgres`, `zod`.

Content guidelines for each entry:

**`core`** — Framework introduction. Explain what MVFM is: a tagless-final DSL for deterministic TypeScript programs. Cover the three-step pattern: `mvfm()` creates an app, the app creates programs, `foldAST()` runs them. Mention `prelude` (bundles all core plugins), `defaults()` (builds an interpreter), `injectInput()` (provides runtime data). This is the conceptual entry point for new users.

**`postgres`** — Must explain: postgres has no `defaultInterpreter` because it requires a real database connection. Show how `serverInterpreter(client, baseInterpreter)` is constructed. Include a `staticCode` field with a non-runnable example showing server-side setup:

```typescript
staticCode: `import { postgres, serverInterpreter, wrapPostgresJs } from "@mvfm/plugin-postgres";
import postgresJs from "postgres";

// 1. Create a postgres.js client
const sql = postgresJs("postgres://user:pass@localhost:5432/mydb");
const client = wrapPostgresJs(sql);

// 2. Build a base interpreter for sub-expressions
const baseInterp = defaults(app);

// 3. Create the postgres interpreter
const pgInterp = serverInterpreter(client, baseInterp);

// 4. Merge and run
await foldAST(
  { ...baseInterp, ...pgInterp },
  injectInput(prog, { userId: 42 })
);`
```

Mention that the playground examples use `wasmPgInterpreter` backed by PGLite (an in-browser WASM Postgres) as a toy environment for demonstration.

**`num`** — Brief: arithmetic and numeric operations. Methods: `sub`, `div`, `mod`, `neg`, `abs`, `floor`, `ceil`, `round`, `min`, `max`. Also registers typeclass instances for `eq`, `ord`, `show`. Pure logic — `defaults()` just works.

**`str`** — Brief: string manipulation. Template literals via `` str`...` ``, plus `concat`, `upper`, `lower`, `trim`, `slice`, `includes`, `startsWith`, `endsWith`, `split`, `join`, `replace`, `len`. Registers `eq` and `show` instances. Pure logic.

**`boolean`** — Brief: boolean logic. Provides `and`, `or`, `not`, `implies`. Registers `eq`, `show`, and `heytingAlgebra` instances. Users typically access boolean operations through typeclass dispatch (e.g., `$.and(a, b)`) rather than the `boolean` namespace directly. Pure logic.

**`eq`** — Brief: equality typeclass. Provides `eq(a, b)` and `neq(a, b)`. Dispatches to type-specific implementations (num, str, boolean) based on inferred argument types. Pure logic.

**`ord`** — Brief: ordering typeclass. Provides `gt`, `gte`, `lt`, `lte`, `compare`. Dispatches based on argument types. Builds on `eq`. Pure logic.

**`st`** — Mutable local state within a program. `$.let(initial)` declares a variable with `.get()`, `.set()`, `.push()` methods. Variables are scoped to the program execution. Interpreter included in `defaults()`.

**`control`** — Control flow: `$.each(collection, fn)` for iteration with side effects, `$.while(cond).body(fn)` for conditional loops. Pure logic, interpreter included in `defaults()`.

**`error`** — Explicit error handling as AST structure. `$.try(expr).catch(fn)` for recovery, `$.fail(msg)` to raise errors, `$.attempt(expr)` for Either-style results, `$.guard(cond, msg)` for assertions, `$.settle(...exprs)` for collecting successes/failures. Interpreter included in `defaults()`.

**`fiber`** — Concurrency primitives. `$.par(a, b, c)` for parallel execution, `$.race(a, b)` for first-to-complete, `$.timeout(expr, ms, fallback)` for cancellation, `$.retry(expr, opts)` for retry with backoff. Concurrency is opt-in and bounded. Interpreter included in `defaults()`.

**`console`** — Console output mirroring the Node.js console API. All standard methods: `$.console.log()`, `$.console.warn()`, `$.console.error()`, `$.console.table()`, etc. External plugin (`@mvfm/plugin-console`). Has a default interpreter, but the playground uses `createConsoleInterpreter(wrappedConsole)` to redirect output.

**`zod`** — Zod schema validation as AST nodes. Build schemas with `$.zod.string()`, `$.zod.number()`, `$.zod.object({...})`, `$.zod.array(schema)`, etc. Parse with `.parse(value)` and `.safeParse(value)`. External plugin (`@mvfm/plugin-zod`). Needs `createZodInterpreter()` passed to `defaults()`.

Each `content` field is raw HTML. Keep it concise — a few `<p>` tags and possibly a `<ul>` for method listings. No need for elaborate formatting.

**Important:** This file must stay under 300 lines. If it exceeds that, split into `indexes-core.ts` (for `core` which is the longest) and `indexes.ts` (for everything else), then merge them in the aggregation file.

**Step 2: Commit**

```bash
git add packages/docs/src/examples/indexes.ts
git commit -m "feat(docs): add namespace index page content for all 13 plugins"
```

---

### Task 3: Update aggregation in index.ts

**Files:**
- Modify: `packages/docs/src/examples/index.ts`

**Step 1: Import and add indexes**

Add import at the top:

```typescript
import indexes from "./indexes";
```

Change the type import:

```typescript
import type { ExampleEntry } from "./types";
```

Add `indexes` to the modules array. Update the return type:

```typescript
const modules: Record<string, ExampleEntry>[] = [
  core,
  boolean,
  num,
  str,
  ord,
  eq,
  st,
  control,
  error,
  fiber,
  console_,
  postgres,
  zodSchemas,
  zodSchemasMore,
  zodWrappers,
  indexes,
];

export function getAllExamples(): Record<string, ExampleEntry> {
  return Object.assign({}, ...modules);
}
```

**Step 2: Commit**

```bash
git add packages/docs/src/examples/index.ts
git commit -m "feat(docs): aggregate namespace index entries into example registry"
```

---

### Task 4: Update route handler to render index pages

**Files:**
- Modify: `packages/docs/src/pages/[...slug].astro`

**Step 1: Import type guard and branch rendering**

Add import of `isNamespaceIndex` from types. In `getStaticPaths()`, no changes needed — the existing logic already maps all keys to slugs.

Update the destructuring and rendering. The page should detect if the entry is a `NamespaceIndex` and render accordingly:

For `NamespaceIndex` entries:
- Render `kind` as `<h1>` (same styling as current)
- Render `content` via Astro's `set:html` directive in a prose container with appropriate text styling
- If `staticCode` exists, render it with the `<Code>` component (same theme as existing fallback)
- No `<Playground>` component

For `NodeExample` entries:
- Existing rendering unchanged

The destructuring needs to handle both types. Use the type guard in the template:

```astro
---
import { isNamespaceIndex } from "../examples/types";
// ... existing imports ...

export function getStaticPaths() {
  const examples = getAllExamples();
  return Object.entries(examples).map(([kind, example]) => ({
    params: { slug: kind },
    props: { kind, example },
  }));
}

const { kind, example } = Astro.props;
const isIndex = isNamespaceIndex(example);
---

<Base title={`${kind} — MVFM`}>
  <div class="pt-4">
    <h1 class="text-2xl font-bold text-base-50 tracking-tight">{kind}</h1>
    {isIndex ? (
      <div class="mt-4 prose-index">
        <div set:html={example.content} />
        {example.staticCode && (
          <div class="mt-8 border border-base-800">
            <Code code={example.staticCode} lang="typescript" theme={MONO_THEME} />
          </div>
        )}
      </div>
    ) : (
      <>
        <p class="mt-2 text-base text-base-500">{example.description}</p>
        <div class="playground-wrapper mt-10">
          <div class="playground-fallback border border-base-800">
            <Code code={example.code} lang="typescript" theme={MONO_THEME} />
          </div>
          <Playground code={example.code} pglite={example.pglite} mockInterpreter={example.mockInterpreter} client:load />
        </div>
      </>
    )}
  </div>
</Base>
```

Add minimal CSS for the prose container in the `<style>` block:

```css
.prose-index {
  color: rgb(var(--base-400));
  font-size: 1rem;
  line-height: 1.75;
}
.prose-index p {
  margin-bottom: 1rem;
}
.prose-index ul {
  list-style: disc;
  padding-left: 1.5rem;
  margin-bottom: 1rem;
}
.prose-index code {
  color: rgb(var(--base-300));
  font-size: 0.875rem;
}
```

**Step 2: Commit**

```bash
git add packages/docs/src/pages/\\[...slug\\].astro
git commit -m "feat(docs): render namespace index pages in route handler"
```

---

### Task 5: Update front page link colors

**Files:**
- Modify: `packages/docs/src/pages/index.astro`

**Step 1: Import types and differentiate colors**

Import `isNamespaceIndex` and get the full entries map to check each key:

```astro
---
import Base from "../layouts/Base.astro";
import { getAllExamples } from "../examples";
import { isNamespaceIndex } from "../examples/types";

const allExamples = getAllExamples();
const allKinds = Object.keys(allExamples).sort();
const coreKinds = allKinds.filter((k) => k.startsWith("core/") || k === "core");
const rest = allKinds.filter((k) => !k.startsWith("core/") && k !== "core");
const kinds = [...coreKinds, ...rest];
---

<Base>
  <div class="pt-16 text-lg leading-loose text-justify">
    {kinds.map((kind) => {
      const isIndex = isNamespaceIndex(allExamples[kind]);
      const color = isIndex ? "text-base-400" : "text-base-500";
      return (
        <Fragment><a href={`/${kind}`} class={`${color} hover:text-base-50 transition-colors mr-4`}>{kind}</a>{" "}</Fragment>
      );
    })}
  </div>
</Base>
```

**Step 2: Commit**

```bash
git add packages/docs/src/pages/index.astro
git commit -m "feat(docs): slightly whiter text for namespace index links on front page"
```

---

### Task 6: Build and verify

**Step 1: Run the build**

```bash
cd packages/docs && npm run build
```

Verify no build errors. Check that all 13 index pages are generated (look for routes like `/core/index.html`, `/postgres/index.html` in the output).

**Step 2: Run type checking**

```bash
npm run check
```

From the repo root. Verify no type errors.

**Step 3: Visual verification**

```bash
cd packages/docs && npm run dev
```

Check:
- Front page shows index links in slightly brighter color
- `/core` page renders prose content correctly
- `/postgres` page renders prose + static code block
- `/core/begin` (existing) still works as before
- No broken links

**Step 4: Final commit (if any fixes needed)**

```bash
git add -A && git commit -m "fix(docs): address build issues for namespace index pages"
```
