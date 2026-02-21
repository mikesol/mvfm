# Koan Gate Status

## Current status

`tests/koans/*.test.ts` are **placeholder gates**.

They execute frozen koan fixtures from `src/__koans__/` using the koans' own internal chain imports (`./NN-...`).
This only proves fixture self-consistency.

These tests do **not** yet gate `@mvfm/core` API conformance.

## Real gate milestone

A koan test becomes a **real gate** when its adapted wrapper logic imports from `@mvfm/core` (or package-local public API barrel) instead of koan-relative imports.

Target state per issue #293:

1. Adapt each koan test/wrapper import graph to `@mvfm/core` exports.
2. Keep koan logic invariant (no semantic edits).
3. Type-check and runtime-check against core exports.
4. Failures require core fixes, never koan edits (unless `spec-change`).

## Convergence plan

`koan.*` is a staging namespace, not the final public shape.

Planned convergence:

1. Finish real gate migration for all koans (`00`-`16`).
2. Swap downstream internals to use koan-model core primitives.
3. Promote stabilized koan-model exports to the main `@mvfm/core` surface.
4. Remove duplicate legacy paths once all gates and existing behavior checks are green.

## Progress checklist

- [x] 00-expr wrapper imports from core API
- [x] 01-increment wrapper imports from core API
- [x] 02-build wrapper imports from core API
- [x] 03-traits wrapper imports from core API
- [x] 03a-composition wrapper imports from core API
- [x] 04-normalize wrapper imports from core API
- [x] 04a-structural wrapper imports from core API
- [x] 04b-accessor wrapper imports from core API
- [ ] 05-predicates wrapper imports from core API
- [ ] 06-select wrapper imports from core API
- [ ] 07-map wrapper imports from core API
- [ ] 08-replace wrapper imports from core API
- [ ] 09-gc wrapper imports from core API
- [ ] 10-dirty wrapper imports from core API
- [ ] 11-commit wrapper imports from core API
- [ ] 12-wrap wrapper imports from core API
- [ ] 13-splice wrapper imports from core API
- [ ] 14-named wrapper imports from core API
- [ ] 15-dagql wrapper imports from core API
- [ ] 16-bridge wrapper imports from core API
