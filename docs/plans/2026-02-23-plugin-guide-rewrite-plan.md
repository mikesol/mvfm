# Plugin Authoring Guide Rewrite — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the 1785-line outdated plugin authoring guide with a ~300-line reference card for LLM agents writing external plugins.

**Architecture:** Single markdown file rewrite. No code changes. Guide uses file path references instead of inline snippets to stay evergreen.

**Tech Stack:** Markdown

---

### Task 1: Read all reference plugins to extract accurate patterns

**Files:**
- Read: `packages/core/src/plugin.ts` (Plugin interface, Handler, Interpreter types)
- Read: `packages/plugin-stripe/src/2025-04-30.basil/index.ts` (simple pattern)
- Read: `packages/plugin-stripe/src/2025-04-30.basil/interpreter.ts`
- Read: `packages/plugin-stripe/src/2025-04-30.basil/client-stripe-sdk.ts`
- Read: `packages/plugin-fal/src/1.9.1/index.ts` (simple pattern)
- Read: `packages/plugin-fal/src/1.9.1/interpreter.ts`
- Read: `packages/plugin-postgres/src/3.4.8/index.ts` (scoped pattern)
- Read: `packages/plugin-postgres/src/3.4.8/interpreter.ts`
- Read: `packages/plugin-postgres/src/3.4.8/handler.server.ts`
- Read: `packages/plugin-postgres/src/3.4.8/handler.client.ts`
- Read: `packages/core/src/fold.ts` (evaluation pipeline)
- Read: `packages/core/src/defaults.ts` (interpreter composition)

**Step 1:** Read all files above and note the actual patterns, field names, and file structures.

**Step 2:** Cross-reference against the design doc at `docs/plans/2026-02-23-plugin-guide-rewrite-design.md` to confirm no new discrepancies.

---

### Task 2: Write the new guide

**Files:**
- Modify: `docs/plugin-authoring-guide.md` (full rewrite)

**Step 1:** Replace the entire contents of `docs/plugin-authoring-guide.md` with the new reference card. Structure:

1. **Source-Level Analysis** — Anti-hallucination gate. Clone upstream, read source, assessment matrix. Hard stop rules. (~50 lines)

2. **The Plugin Contract** — Actual Plugin interface fields from `packages/core/src/plugin.ts`. What each field does. `kinds` keys = exhaustive node kind list. Configured vs unconfigured pattern. File path to reference example. (~60 lines)

3. **File Patterns** — Simple (stripe/fal: index + interpreter + client-sdk) vs Scoped (postgres/openai: + handler.server + handler.client). Decision rule. File path references. (~40 lines)

4. **Interpreter Pattern** — async function* handlers, yield child indices, IO via injected client, defaultInterpreter. File path to type definitions. (~40 lines)

5. **Tests** — Three tiers with what each covers. File path references to example test directories. Container choices table. (~40 lines)

6. **Standing Rules** — The 7 corrected non-negotiable rules. (~40 lines)

7. **Docs Examples** — Every node kind needs an example in `packages/docs/src/examples/`. Reference `packages/docs/src/examples/types.ts` for the type. (~20 lines)

**Step 2:** Verify the guide is under 350 lines.

**Step 3:** Verify every file path reference in the guide points to an actual file.

---

### Task 3: Verify build still passes

**Step 1:** Run `npm run build && npm run check`

Expected: PASS (no code changes, only docs)

---

### Task 4: Commit

```bash
git add docs/plugin-authoring-guide.md
git commit -m "docs: rewrite plugin authoring guide as concise reference card

Closes #304"
```
