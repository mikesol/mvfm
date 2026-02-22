# Plugin Authoring Guide Rewrite — Design

**Issue:** #304
**Date:** 2026-02-23
**Approach:** Reference Card (~300 lines, LLM agent audience, external plugins only)

## Problem

The current guide (1785 lines) has accreted outdated content:
- References `nodeKinds` field that doesn't exist on Plugin
- Prescribes file structures that don't match reality
- Says "config goes in AST nodes" but all plugins use closure capture
- Standing rules contradict actual interpreter patterns
- Interleaves native and external plugin content (only external matters)
- Inline code examples that have drifted from source

## Design Decisions

1. **Audience:** LLM agents only. Terse, mechanical, no motivation.
2. **Scope:** External plugins only (90%+ of contributions).
3. **Examples:** File path references, not inline snippets. Agents read the real source.
4. **Source analysis (Step 0):** Kept as firm gate — agents hallucinate APIs without it. Trimmed of process overhead (sizing rules, scoping tables).

## Structure

### Section 1: Source-Level Analysis
- Clone upstream at exact version, read source not docs
- Assessment matrix: maps cleanly / needs deviation / can't model
- Hard stop if source can't be verified
- Kill: sizing rules, scoping tables, lengthy formatting

### Section 2: The Plugin Contract
- Reference `packages/core/src/plugin.ts` for canonical type
- 6 fields: name, ctors, kinds, traits, lifts, defaultInterpreter?
- `kinds` keys ARE the exhaustive node kind list (no `nodeKinds` field)
- Configured (factory fn) vs unconfigured (const)
- Reference: `packages/plugin-fal/src/1.9.1/index.ts`

### Section 3: File Patterns
- **Simple (request-response):** index.ts, interpreter.ts, client-<sdk>.ts
  - References: stripe, fal
- **Scoped (transactions/sessions):** + handler.server.ts, handler.client.ts
  - References: postgres, openai
- Decision rule: all operations are call-and-return → simple; some create scopes → scoped

### Section 4: Interpreter Pattern
- async function* handlers, yield child indices
- IO via injected client
- defaultInterpreter for sensible defaults
- Reference: plugin.ts Handler/Interpreter types

### Section 5: Tests
- Tier 1: AST construction (all plugins)
- Tier 2: Interpretation with mock client (all plugins)
- Tier 3: Integration with real/mock service (all plugins)
- File path references to test examples

### Section 6: Standing Rules (corrected)
1. Namespace node kinds: plugin/kind
2. kinds must declare every emitted kind
3. Constructors are pure
4. Interpreters compose via defaults() or spread
5. Every public export gets TSDoc
6. Every node kind needs docs example
7. Reusable logic → its own plugin

## What's Removed
- All native-plugin-specific content
- `nodeKinds` field references (doesn't exist)
- Inline code examples (replaced with file references)
- Sizing rules (60/30/10, 75/25)
- "Config in AST nodes" advice (plugins use closure capture)
- Standing rule "never import backend SDK from interpreter" (wrong)
- Versioning rules section (obvious from directory structure)
- Client handler / server handler as "required" (only for scoped plugins)
- Pre-merge checklist reference (separate doc)
- Interpreted type-shape rigor section (moved to PR checklist if needed)
