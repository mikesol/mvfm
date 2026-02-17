# Design: Zod Plugin Examples (#238)

## Goal

Add documentation examples for all 45 zod node kinds, following established patterns from `console.ts`, `str.ts`, etc.

## Key Decisions

### Split file structure

Zod currently has 45 node kinds but will grow to 90-135. A single file would exceed the 300-line limit. Split into focused modules from the start:

- `packages/docs/src/examples/zod-schemas.ts` — schema type nodes (~32 kinds: string, number, object, array, etc.)
- `packages/docs/src/examples/zod-wrappers.ts` — wrapper/modifier nodes (~13 kinds: parse, optional, nullable, etc.)

Each file exports a `Record<string, NodeExample>`. Both are merged in `index.ts`.

### No mockInterpreter

Zod is pure schema validation — no interpreter infrastructure needed. Each example uses only `description` and `code`.

### Example style

- One-line `description` in consistent voice ("Creates a zod string schema", "Parses a value against a schema")
- `code` shows executable `$` DSL usage
- No `plugins` array needed (zod is the implicit plugin under test)
- Keys sorted alphabetically within each file

## Files to create/modify

1. **Create** `packages/docs/src/examples/zod-schemas.ts`
2. **Create** `packages/docs/src/examples/zod-wrappers.ts`
3. **Modify** `packages/docs/src/examples/index.ts` — import both zod modules, add to `modules` array
4. **Modify** `scripts/check-docs-coverage.ts` — add zod plugin import

## Branching

- Create `docs/full-buildout` branch from `main`
- Worktree at `.worktrees/mvfm-238`
- PR targets `docs/full-buildout`

## Validation

- `npm run build && npm run check && npm test` passes
- All 45 zod node kinds have examples
- Both files under 300 lines
