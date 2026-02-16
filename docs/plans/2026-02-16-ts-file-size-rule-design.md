# TS File Size Rule Design

## Context
Issue #185 requires enforcing a 300-line file-size limit with Biome and addressing existing TypeScript files over that limit. The user additionally requires strict enforcement for `.ts` files only and no TypeScript opt-outs.

## Design
- Enable `nursery/noExcessiveLinesPerFile` at error level with `maxLines: 300` and `skipBlankLines: false`.
- Scope Biome inputs to TypeScript only (`packages/*/src/**/*.ts`, `packages/*/tests/**/*.ts`) so markdown is unaffected.
- Use check-driven refactoring: run `pnpm run check` and split each offending file into cohesive submodules.
- Keep behavior stable by re-exporting through existing entry files and preserving public API surfaces.
- Mirror source splits in tests where a single test file exceeds 300 lines.

## Non-goals
- No suppression comments for TypeScript files.
- No broad architecture changes unrelated to file-length enforcement.
