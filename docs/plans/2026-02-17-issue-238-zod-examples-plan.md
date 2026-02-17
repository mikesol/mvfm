# Zod Plugin Examples Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add documentation examples for all 45 zod node kinds, split across two files for scalability.

**Architecture:** Two example files (`zod-schemas.ts` for 32 schema-type nodes, `zod-wrappers.ts` for 13 common/wrapper nodes), wired into the existing docs index and coverage script. Each file exports a `Record<string, NodeExample>`, following the established pattern from `str.ts` and `console.ts`.

**Tech Stack:** TypeScript, mvfm DSL (`$.zod.*` namespace)

---

### Task 1: Set up branch and worktree

**Step 1: Assign the issue**

Run: `gh issue edit 238 --repo mikesol/mvfm --add-assignee @me --remove-label ready --add-label in-progress`

**Step 2: Create the docs/full-buildout branch**

Run: `git branch docs/full-buildout main && git push -u origin docs/full-buildout`

**Step 3: Create worktree**

Run: `git worktree add .worktrees/mvfm-238 -b issue-238 docs/full-buildout`

**Step 4: Verify**

Run: `cd .worktrees/mvfm-238 && git log --oneline -1`
Expected: HEAD matches main's latest commit

---

### Task 2: Create zod-schemas.ts (32 schema-type node kinds)

**Files:**
- Create: `packages/docs/src/examples/zod-schemas.ts`

**Step 1: Create the file**

All 32 schema-type node kinds, alphabetically. Each entry uses `plugins: ["@mvfm/plugin-zod"]`. Code snippets use the `$.zod.*` namespace pattern from tests. No `mockInterpreter` needed.

```typescript
import type { NodeExample } from "./types";

const examples: Record<string, NodeExample> = {
  "zod/any": {
    description: "Schema that accepts any value without validation",
    code: `const app = mvfm(prelude, zod);
const prog = app(($) => $.zod.any().parse($.input));`,
    plugins: ["@mvfm/plugin-zod"],
  },
  "zod/array": {
    description: "Schema for validating arrays with a given element schema",
    code: `const app = mvfm(prelude, zod);
const prog = app(($) => $.zod.array($.zod.string()).min(1).parse($.input));`,
    plugins: ["@mvfm/plugin-zod"],
  },
  "zod/bigint": {
    description: "Schema for validating bigint values",
    code: `const app = mvfm(prelude, zod);
const prog = app(($) => $.zod.bigint().positive().parse($.input));`,
    plugins: ["@mvfm/plugin-zod"],
  },
  "zod/boolean": {
    description: "Schema for validating boolean values",
    code: `const app = mvfm(prelude, zod);
const prog = app(($) => $.zod.boolean().parse($.input));`,
    plugins: ["@mvfm/plugin-zod"],
  },
  "zod/custom": {
    description: "Schema with a custom validation function",
    code: `const app = mvfm(prelude, zod);
const prog = app(($) => $.zod.custom().parse($.input));`,
    plugins: ["@mvfm/plugin-zod"],
  },
  "zod/date": {
    description: "Schema for validating Date instances",
    code: `const app = mvfm(prelude, zod);
const prog = app(($) => $.zod.date().parse($.input));`,
    plugins: ["@mvfm/plugin-zod"],
  },
  "zod/enum": {
    description: "Schema for a fixed set of string literal values",
    code: `const app = mvfm(prelude, zod);
const prog = app(($) => $.zod.enum(["red", "green", "blue"]).parse($.input));`,
    plugins: ["@mvfm/plugin-zod"],
  },
  "zod/intersection": {
    description: "Schema combining two schemas with logical AND",
    code: `const app = mvfm(prelude, zod);
const prog = app(($) =>
  $.zod.intersection(
    $.zod.object({ name: $.zod.string() }),
    $.zod.object({ age: $.zod.number() })
  ).parse($.input)
);`,
    plugins: ["@mvfm/plugin-zod"],
  },
  "zod/literal": {
    description: "Schema that matches a single literal value",
    code: `const app = mvfm(prelude, zod);
const prog = app(($) => $.zod.literal("hello").parse($.input));`,
    plugins: ["@mvfm/plugin-zod"],
  },
  "zod/map": {
    description: "Schema for validating Map instances with typed keys and values",
    code: `const app = mvfm(prelude, zod);
const prog = app(($) => $.zod.map($.zod.string(), $.zod.number()).parse($.input));`,
    plugins: ["@mvfm/plugin-zod"],
  },
  "zod/nan": {
    description: "Schema that validates a value is NaN",
    code: `const app = mvfm(prelude, zod);
const prog = app(($) => $.zod.nan().parse($.input));`,
    plugins: ["@mvfm/plugin-zod"],
  },
  "zod/native_enum": {
    description: "Schema wrapping a TypeScript native enum",
    code: `const app = mvfm(prelude, zod);
const prog = app(($) => $.zod.nativeEnum({ Up: 0, Down: 1 }).parse($.input));`,
    plugins: ["@mvfm/plugin-zod"],
  },
  "zod/never": {
    description: "Schema that rejects all values",
    code: `const app = mvfm(prelude, zod);
const prog = app(($) => $.zod.never().parse($.input));`,
    plugins: ["@mvfm/plugin-zod"],
  },
  "zod/null": {
    description: "Schema that only accepts null",
    code: `const app = mvfm(prelude, zod);
const prog = app(($) => $.zod.null().parse($.input));`,
    plugins: ["@mvfm/plugin-zod"],
  },
  "zod/number": {
    description: "Schema for validating numeric values with optional constraints",
    code: `const app = mvfm(prelude, zod);
const prog = app(($) => $.zod.number().min(0).max(100).parse($.input));`,
    plugins: ["@mvfm/plugin-zod"],
  },
  "zod/object": {
    description: "Schema for validating objects with a defined shape",
    code: `const app = mvfm(prelude, zod);
const prog = app(($) =>
  $.zod.object({ name: $.zod.string(), age: $.zod.number() }).parse($.input)
);`,
    plugins: ["@mvfm/plugin-zod"],
  },
  "zod/promise": {
    description: "Schema wrapping another schema in a Promise",
    code: `const app = mvfm(prelude, zod);
const prog = app(($) => $.zod.promise($.zod.string()).parse($.input));`,
    plugins: ["@mvfm/plugin-zod"],
  },
  "zod/record": {
    description: "Schema for objects with uniform key and value types",
    code: `const app = mvfm(prelude, zod);
const prog = app(($) => $.zod.record($.zod.string(), $.zod.number()).parse($.input));`,
    plugins: ["@mvfm/plugin-zod"],
  },
  "zod/set": {
    description: "Schema for validating Set instances with a typed element schema",
    code: `const app = mvfm(prelude, zod);
const prog = app(($) => $.zod.set($.zod.string()).parse($.input));`,
    plugins: ["@mvfm/plugin-zod"],
  },
  "zod/string": {
    description: "Schema for validating string values with optional checks",
    code: `const app = mvfm(prelude, zod);
const prog = app(($) => $.zod.string().min(1).max(255).parse($.input));`,
    plugins: ["@mvfm/plugin-zod"],
  },
  "zod/symbol": {
    description: "Schema that only accepts symbol values",
    code: `const app = mvfm(prelude, zod);
const prog = app(($) => $.zod.symbol().parse($.input));`,
    plugins: ["@mvfm/plugin-zod"],
  },
  "zod/tuple": {
    description: "Schema for fixed-length arrays with per-position types",
    code: `const app = mvfm(prelude, zod);
const prog = app(($) =>
  $.zod.tuple([$.zod.string(), $.zod.number()]).parse($.input)
);`,
    plugins: ["@mvfm/plugin-zod"],
  },
  "zod/undefined": {
    description: "Schema that only accepts undefined",
    code: `const app = mvfm(prelude, zod);
const prog = app(($) => $.zod.undefined().parse($.input));`,
    plugins: ["@mvfm/plugin-zod"],
  },
  "zod/union": {
    description: "Schema matching any one of several schemas (logical OR)",
    code: `const app = mvfm(prelude, zod);
const prog = app(($) =>
  $.zod.union([$.zod.string(), $.zod.number()]).parse($.input)
);`,
    plugins: ["@mvfm/plugin-zod"],
  },
  "zod/unknown": {
    description: "Schema that accepts any value (type-safe alternative to any)",
    code: `const app = mvfm(prelude, zod);
const prog = app(($) => $.zod.unknown().parse($.input));`,
    plugins: ["@mvfm/plugin-zod"],
  },
  "zod/void": {
    description: "Schema that only accepts undefined (void return type)",
    code: `const app = mvfm(prelude, zod);
const prog = app(($) => $.zod.void().parse($.input));`,
    plugins: ["@mvfm/plugin-zod"],
  },
  "zod/xor": {
    description: "Discriminated union — exactly one branch must match",
    code: `const app = mvfm(prelude, zod);
const prog = app(($) =>
  $.zod.xor("type", [
    $.zod.object({ type: $.zod.literal("a"), value: $.zod.string() }),
    $.zod.object({ type: $.zod.literal("b"), value: $.zod.number() }),
  ]).parse($.input)
);`,
    plugins: ["@mvfm/plugin-zod"],
  },
  "zod/transform": {
    description: "Transform parsed output through a mapping function expression",
    code: `const app = mvfm(prelude, zod);
const prog = app(($) =>
  $.zod.transform($.zod.string(), "toUpperCase").parse($.input)
);`,
    plugins: ["@mvfm/plugin-zod"],
  },
  "zod/pipe": {
    description: "Pipe one schema's output into another for staged validation",
    code: `const app = mvfm(prelude, zod);
const prog = app(($) =>
  $.zod.pipe($.zod.string(), $.zod.string().min(1)).parse($.input)
);`,
    plugins: ["@mvfm/plugin-zod"],
  },
  "zod/preprocess": {
    description: "Apply a preprocessing function before schema validation",
    code: `const app = mvfm(prelude, zod);
const prog = app(($) =>
  $.zod.preprocess("String", $.zod.string()).parse($.input)
);`,
    plugins: ["@mvfm/plugin-zod"],
  },
};

export default examples;
```

Note: This is 30 kinds. `zod/parse` and `zod/safe_parse` are covered by every example (`.parse()` / `.safeParse()` calls), but they need their own entries in `zod-wrappers.ts` since they are distinct node kinds.

**Step 2: Verify file is under 300 lines**

Run: `wc -l packages/docs/src/examples/zod-schemas.ts`
Expected: Under 300

---

### Task 3: Create zod-wrappers.ts (13 common/wrapper node kinds)

**Files:**
- Create: `packages/docs/src/examples/zod-wrappers.ts`

**Step 1: Create the file**

All 13 wrapper/parsing node kinds.

```typescript
import type { NodeExample } from "./types";

const examples: Record<string, NodeExample> = {
  "zod/branded": {
    description: "Brand a schema with a nominal type tag",
    code: `const app = mvfm(prelude, zod);
const prog = app(($) => $.zod.string().brand("Email").parse($.input));`,
    plugins: ["@mvfm/plugin-zod"],
  },
  "zod/catch": {
    description: "Provide a fallback value when parsing fails",
    code: `const app = mvfm(prelude, zod);
const prog = app(($) => $.zod.string().catch("fallback").parse($.input));`,
    plugins: ["@mvfm/plugin-zod"],
  },
  "zod/default": {
    description: "Provide a default value for undefined input",
    code: `const app = mvfm(prelude, zod);
const prog = app(($) => $.zod.string().default("hello").parse($.input));`,
    plugins: ["@mvfm/plugin-zod"],
  },
  "zod/nonoptional": {
    description: "Mark a schema as required (unwrap optional)",
    code: `const app = mvfm(prelude, zod);
const prog = app(($) => $.zod.string().nonoptional().parse($.input));`,
    plugins: ["@mvfm/plugin-zod"],
  },
  "zod/nullable": {
    description: "Allow null as a valid value for a schema",
    code: `const app = mvfm(prelude, zod);
const prog = app(($) => $.zod.string().nullable().parse($.input));`,
    plugins: ["@mvfm/plugin-zod"],
  },
  "zod/nullish": {
    description: "Allow both null and undefined as valid values",
    code: `const app = mvfm(prelude, zod);
const prog = app(($) => $.zod.string().nullish().parse($.input));`,
    plugins: ["@mvfm/plugin-zod"],
  },
  "zod/optional": {
    description: "Allow undefined as a valid value for a schema",
    code: `const app = mvfm(prelude, zod);
const prog = app(($) => $.zod.string().optional().parse($.input));`,
    plugins: ["@mvfm/plugin-zod"],
  },
  "zod/parse": {
    description: "Parse input against a schema, throwing on failure",
    code: `const app = mvfm(prelude, zod);
const prog = app(($) => $.zod.string().parse($.input));`,
    plugins: ["@mvfm/plugin-zod"],
  },
  "zod/parse_async": {
    description: "Parse input asynchronously, throwing on failure",
    code: `const app = mvfm(prelude, zod);
const prog = app(($) => $.zod.string().parseAsync($.input));`,
    plugins: ["@mvfm/plugin-zod"],
  },
  "zod/prefault": {
    description: "Set a pre-validation default value (applied before parsing)",
    code: `const app = mvfm(prelude, zod);
const prog = app(($) => $.zod.string().prefault("pre").parse($.input));`,
    plugins: ["@mvfm/plugin-zod"],
  },
  "zod/readonly": {
    description: "Mark a schema's output as readonly",
    code: `const app = mvfm(prelude, zod);
const prog = app(($) => $.zod.string().readonly().parse($.input));`,
    plugins: ["@mvfm/plugin-zod"],
  },
  "zod/safe_parse": {
    description: "Parse input returning a result object instead of throwing",
    code: `const app = mvfm(prelude, zod);
const prog = app(($) => $.zod.string().safeParse($.input));`,
    plugins: ["@mvfm/plugin-zod"],
  },
  "zod/safe_parse_async": {
    description: "Parse input asynchronously returning a result object",
    code: `const app = mvfm(prelude, zod);
const prog = app(($) => $.zod.string().safeParseAsync($.input));`,
    plugins: ["@mvfm/plugin-zod"],
  },
};

export default examples;
```

**Step 2: Verify file is under 300 lines**

Run: `wc -l packages/docs/src/examples/zod-wrappers.ts`
Expected: Under 300

---

### Task 4: Wire into index.ts

**Files:**
- Modify: `packages/docs/src/examples/index.ts`

**Step 1: Add imports and modules**

Add after the `str` import:
```typescript
import zodSchemas from "./zod-schemas";
import zodWrappers from "./zod-wrappers";
```

Add to the `modules` array (after `console_`):
```typescript
  zodSchemas,
  zodWrappers,
```

---

### Task 5: Add zod to check-docs-coverage.ts

**Files:**
- Modify: `scripts/check-docs-coverage.ts`

**Step 1: Add zod import**

Add after the `consolePlugin` import:
```typescript
import { zod as zodPlugin } from "../packages/plugin-zod/src/index.js";
```

**Step 2: Add to plugins array**

Add to the `plugins` array:
```typescript
  zodPlugin,
```

---

### Task 6: Build and validate

**Step 1: Run build**

Run: `npm run build`
Expected: Clean build, no errors

**Step 2: Run type check**

Run: `npm run check`
Expected: No type errors

**Step 3: Run tests**

Run: `npm test`
Expected: All tests pass

**Step 4: Run docs coverage check**

Run: `npx tsx scripts/check-docs-coverage.ts`
Expected: All node kinds covered (count increases by 45)

---

### Task 7: Commit and create PR

**Step 1: Commit**

```bash
git add packages/docs/src/examples/zod-schemas.ts packages/docs/src/examples/zod-wrappers.ts packages/docs/src/examples/index.ts scripts/check-docs-coverage.ts
git commit -m "docs: add zod plugin examples for all 45 node kinds (#238)"
```

**Step 2: Push and create PR**

```bash
git push -u origin issue-238
gh pr create --base docs/full-buildout --title "Docs: add zod plugin examples" --body "$(cat <<'EOF'
## Summary

- Adds documentation examples for all 45 zod node kinds
- Split across `zod-schemas.ts` (32 schema types) and `zod-wrappers.ts` (13 wrapper/parse nodes)
- Wired into docs index and coverage script
- First external plugin documented — establishes pattern for later plugins

Closes #238

## Design alignment

Follows plugin-authoring-guide contract. Examples use `$.zod.*` namespace per established patterns.

## Validation performed

- `npm run build && npm run check && npm test` passes
- All 45 zod node kinds have examples
- Both files under 300 lines

## Test plan

- [ ] Verify `npm run build` passes
- [ ] Verify `npm run check` passes
- [ ] Verify `npm test` passes
- [ ] Verify docs coverage script includes all zod kinds

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
