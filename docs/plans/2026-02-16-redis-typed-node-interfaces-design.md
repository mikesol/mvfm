# Redis Typed Node Interfaces Design

## Context
Issue `#191` identifies that `packages/plugin-redis/src/5.4.1/interpreter.ts` still has many handler parameters typed as `any`, which defeats the `TypedNode<T>` phantom typing pattern already used across migrated interpreters.

## Goals
- Define typed node interfaces for all 35 redis node kinds.
- Replace all `node: any` handler signatures with specific node interfaces.
- Keep runtime behavior unchanged.
- Add regression tests for both runtime behavior and compile-time typing guarantees.

## Non-goals
- No runtime behavior changes.
- No command surface expansion.
- No per-command-family file split.

## Design
### 1. Node typing model
Introduce concrete per-kind interfaces in the redis interpreter module, grouped by existing sections:
- String commands
- Key commands
- Hash commands
- List commands

Each interface will:
- Extend `TypedNode<TReturn>`
- Pin `kind` to a string literal (e.g. `"redis/hget"`)
- Type each child field as `TypedNode<...>` or arrays thereof
- Model optional fields (`args`, `count`) explicitly

Shared structural bases (`key`, `keys`, key+value patterns) remain, but all 35 concrete kinds will have concrete interfaces.

### 2. Interpreter updates
Update each handler signature to use its concrete interface. Handler internals remain equivalent, only type-safe field access replaces `any` assumptions.

### 3. Type regression coverage
Add type-level assertions using `expectTypeOf` and targeted `@ts-expect-error` checks in plugin redis tests to ensure command nodes are correctly typed and invalid field access on typed nodes is rejected.

### 4. Runtime regression coverage
Keep interpreter command-shape tests and add/adjust focused tests only where needed to ensure no command argument behavior changed.

## Risks and mitigations
- Risk: incorrect return typing for a node kind.
- Mitigation: align each interface return type with `packages/plugin-redis/src/5.4.1/index.ts` method signatures and existing test expectations.

## Validation
- `npm run build`
- `npm run check`
- `npm test`

