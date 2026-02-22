# Slack Dynamic Docs Examples — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Generate 271 Slack method documentation examples dynamically at Astro build time using TS compiler API + faker.

**Architecture:** A `slack/` subdirectory under `packages/docs/src/examples/` contains modules that parse `@slack/web-api` response type `.d.ts` files, generate deterministic mock data with faker, and produce `NodeExample` entries with runnable code. The existing `getAllExamples()` pipeline picks them up unchanged.

**Tech Stack:** TypeScript compiler API, @faker-js/faker, Lorem Picsum, Astro SSG

---

### Task 1: Export NODE_TO_METHOD from plugin-slack

The docs generator needs the nodeKind → API method mapping. Currently internal.

**Files:**
- Modify: `packages/plugin-slack/src/7.14.0/index.ts`
- Modify: `packages/plugin-slack/src/index.ts`

**Step 1: Add export to version barrel**

In `packages/plugin-slack/src/7.14.0/index.ts`, add:

```typescript
export { NODE_TO_METHOD } from "./generated/interpreter";
```

**Step 2: Add export to public API**

In `packages/plugin-slack/src/index.ts`, add:

```typescript
export { NODE_TO_METHOD } from "./7.14.0";
```

**Step 3: Verify build**

Run: `npm run build --filter @mvfm/plugin-slack`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/plugin-slack/src/7.14.0/index.ts packages/plugin-slack/src/index.ts
git commit -m "feat(slack): export NODE_TO_METHOD for docs generator"
```

---

### Task 2: Add faker dependency to docs package

**Files:**
- Modify: `packages/docs/package.json`

**Step 1: Install faker**

Run: `pnpm add -D @faker-js/faker --filter @mvfm/docs`

**Step 2: Commit**

```bash
git add packages/docs/package.json pnpm-lock.yaml
git commit -m "chore(docs): add @faker-js/faker for slack mock generation"
```

---

### Task 3: Create field-heuristics.ts

The faker-based field-name → value mapping. Extracted from the spike.

**Files:**
- Create: `packages/docs/src/examples/slack/field-heuristics.ts`

**Step 1: Write the module**

This file exports three functions:
- `picsum(w, h)` — returns `https://picsum.photos/seed/{id}/{w}/{h}`
- `fakeString(fieldName)` — Slack-aware string generator (IDs, timestamps, URLs, image picsum URLs, status values, etc.)
- `fakeNumber(fieldName)` — Slack-aware number generator (timestamps, counts, dimensions, etc.)
- `singularize(fieldName)` — maps plural array field names to singular for element generation (`channels` → `channel`, `participants` → `user`, etc.)

Copy these directly from the spike at `.worktrees/issue-246/packages/plugin-slack/scripts/spike-fastcheck.ts`, functions `picsum`, `fakeString`, `fakeNumber`, `singularize`. Keep the file under 200 lines.

**Step 2: Commit**

```bash
git add packages/docs/src/examples/slack/field-heuristics.ts
git commit -m "feat(docs): slack field-heuristics for mock data generation"
```

---

### Task 4: Create type-parser.ts

Parses `.d.ts` response type files into a `TypeModel`.

**Files:**
- Create: `packages/docs/src/examples/slack/type-parser.ts`

**Step 1: Write the module**

Exports:
- Types: `TypeModel`, `InterfaceModel`, `FieldModel`, `TypeRef`
- Function: `parseResponseFile(filePath: string): TypeModel`

Copy the type definitions and `parseResponseFile` function from the spike. The function uses `ts.createProgram` to parse a single `.d.ts` file and walks the AST to collect interfaces, enums, and type aliases into a `TypeModel`.

**Step 2: Commit**

```bash
git add packages/docs/src/examples/slack/type-parser.ts
git commit -m "feat(docs): TS compiler API type parser for Slack response types"
```

---

### Task 5: Create mock-generator.ts

Generates deterministic mock data from a TypeModel.

**Files:**
- Create: `packages/docs/src/examples/slack/mock-generator.ts`

**Step 1: Write the module**

Exports:
- `generateResponse(responseName: string, model: TypeModel): unknown`

Internally has `generate(typeRef, model, visited, depth, fieldName?)` which dispatches on `TypeRef.kind` and calls into the field-heuristics functions. Key behaviors:
- MAX_DEPTH = 5
- Arrays: 1-2 elements, parent field name propagated via `singularize()`
- Refs: cycle detection via visited set, external refs (e.g. `WebAPICallResult`) → `{}`
- Unions: pick first non-null member
- Intersections: merge all object-like members
- Records: 2 entries with alphanumeric keys
- All fields populated (maximalist)

Copy `generate`, `generateFields`, `generateInterface`, `generateResponse` from the spike.

**Step 2: Commit**

```bash
git add packages/docs/src/examples/slack/mock-generator.ts
git commit -m "feat(docs): faker mock data generator for Slack response types"
```

---

### Task 6: Create code-templates.ts

Generates the `code` string for each NodeExample.

**Files:**
- Create: `packages/docs/src/examples/slack/code-templates.ts`

**Step 1: Write the module**

Exports:
- `generateCodeString(accessor: string, nodeKind: string, isOptional: boolean): string`

The `accessor` is the dot-path like `chat.postMessage`. The function generates:

```typescript
const app = mvfm(prelude, console_, slack_);
const prog = app({}, ($) => {
  const result = $.slack.${accessor}(${isOptional ? '' : '{ /* ... */ }'});
  return $.begin($.console.log(result), result);
});
await foldAST(defaults(app), prog);
```

Note: `defaults(app)` with NO explicit slack interpreter override — the `mockInterpreter` field on `NodeExample` handles this. The monkey-patched `defaults` in playground-scope merges `mockOverrides` automatically.

For the input args: for non-optional methods, include a minimal args object. Derive sensible arg names from the API method (e.g. `chat.postMessage` → `{ channel: "C0123456789", text: "Hello from mvfm!" }`). For methods we can't guess args for, use an empty comment `{ /* see Slack API docs */ }`.

**Step 2: Commit**

```bash
git add packages/docs/src/examples/slack/code-templates.ts
git commit -m "feat(docs): code template generator for Slack examples"
```

---

### Task 7: Create slack/index.ts — the orchestrator

**Files:**
- Create: `packages/docs/src/examples/slack/index.ts`

**Step 1: Write the module**

Exports:
- `generateSlackExamples(): Record<string, NodeExample>`

Flow:
1. Import `NODE_TO_METHOD` from `@mvfm/plugin-slack`
2. For each `[nodeKind, apiMethod]` entry:
   a. Derive response type filename: `apiMethod.split(".").map(s => s[0].toUpperCase() + s.slice(1)).join("") + "Response.d.ts"`
   b. Resolve the file path: `require.resolve("@slack/web-api")` → navigate to `dist/types/response/`
   c. Parse the response type file with `parseResponseFile()`
   d. Set `faker.seed(hash(nodeKind))` for deterministic per-method output
   e. Generate mock data with `generateResponse()`
   f. Generate code string with `generateCodeString()`
   g. Build the `NodeExample`: `{ description, code, plugins: ["@mvfm/plugin-slack"], mockInterpreter }`
3. The `mockInterpreter` string is: `` `({ "${nodeKind}": () => (${JSON.stringify(mockData)}) })` ``
4. The key is the nodeKind (e.g. `"slack/chat_postMessage"`)
5. Add a `NamespaceIndex` at key `"slack"` with landing page prose

The description for each method: `"Call the Slack ${apiMethod} API method"`.

**Step 2: Commit**

```bash
git add packages/docs/src/examples/slack/index.ts
git commit -m "feat(docs): slack example orchestrator — generates 271 NodeExamples"
```

---

### Task 8: Create slack.ts — the top-level export

**Files:**
- Create: `packages/docs/src/examples/slack.ts`

**Step 1: Write the module**

```typescript
import type { ExampleEntry } from "./types";
import { generateSlackExamples } from "./slack/index";

const generated = generateSlackExamples();

// Tier 2: hand-written composed examples override specific keys
// TODO: add composed examples for chat.postMessage, conversations.list, etc.

const examples: Record<string, ExampleEntry> = {
  ...generated,
};

export default examples;
```

**Step 2: Commit**

```bash
git add packages/docs/src/examples/slack.ts
git commit -m "feat(docs): slack examples entry point"
```

---

### Task 9: Register slack in examples/index.ts

**Files:**
- Modify: `packages/docs/src/examples/index.ts`

**Step 1: Add import and registration**

Add import:
```typescript
import slack from "./slack";
```

Add `slack` to the `modules` array.

**Step 2: Commit**

```bash
git add packages/docs/src/examples/index.ts
git commit -m "feat(docs): register slack examples in example index"
```

---

### Task 10: Add slack to playground-scope.ts

**Files:**
- Modify: `packages/docs/src/playground-scope.ts`

**Step 1: Import slack plugin**

Add after the existing plugin imports:
```typescript
const pluginSlack = await import("@mvfm/plugin-slack");
```

**Step 2: Add to injected scope**

Add to the `injected` object:
```typescript
slack_: pluginSlack.slack({ token: "xoxb-mock-token" }),
```

No interpreter needed in the scope — each example's `mockInterpreter` field provides handlers, and the monkey-patched `defaults()` merges them automatically. The `defaultInterpreter` on the slack plugin won't fire because `mockOverrides` takes precedence.

**Step 3: Commit**

```bash
git add packages/docs/src/playground-scope.ts
git commit -m "feat(docs): add slack plugin to playground scope"
```

---

### Task 11: Build and verify

**Step 1: Run the full build**

Run: `npm run build` (from monorepo root)
Expected: All packages build successfully. The docs build should log no errors and generate 271+ slack pages.

**Step 2: Count generated pages**

Run: `ls packages/docs/dist/mvfm/slack/ | wc -l`
Expected: ~272 entries (271 methods + 1 landing page)

**Step 3: Spot-check a simple page**

Run: `cat packages/docs/dist/mvfm/slack/chat_postMessage/index.html | grep -o 'playground'`
Expected: Match found (playground component rendered)

**Step 4: Spot-check mock data**

Run: `cat packages/docs/dist/mvfm/slack/chat_getPermalink/index.html | grep -o 'picsum'`
Expected: No match (simple response has no image fields — but confirms page exists)

**Step 5: Commit any fixes**

---

### Task 12: Run tests and lint

**Step 1: Full validation**

Run: `npm run build && npm run check && npm test`
Expected: All pass

**Step 2: Final commit if needed**

---

## Notes for implementer

- The spike script at `packages/plugin-slack/scripts/spike-fastcheck.ts` contains validated implementations of all core functions. Copy from there, don't reinvent.
- The `@slack/web-api` `.d.ts` files use `declare enum` (not `const enum`), so the TS compiler API can read them.
- `faker.seed()` accepts a number. Use a simple string hash (e.g. sum of char codes) of the nodeKind for per-method determinism.
- The `NODE_TO_METHOD` map has 271 entries. Some response type files may not exist for all methods (some use generic `WebAPICallResult`). Handle missing files gracefully by generating a minimal `{ ok: true }` mock.
- Keep every file under 300 lines.
