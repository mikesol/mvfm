# Error/Fiber/Control Typed Nodes Design

## Summary
Issue #209 extends typed handler enforcement to the remaining core prelude plugins: `error`, `fiber`, and `control`.

## Goals
- Add typed node interfaces for all listed kinds:
  - error: `error/try`, `error/fail`, `error/attempt`, `error/guard`, `error/settle`
  - fiber: `fiber/par_map`, `fiber/race`, `fiber/timeout`, `fiber/retry`
  - control: `control/each`, `control/while`
- Register all of them in `NodeTypeMap` via `declare module "@mvfm/core"` augmentation.
- Ensure each handler map uses `typedInterpreter`.
- Add default control runtime interpreter so `defaults(app)` executes control loops.

## Non-goals
- No plugin API shape changes for `$` methods.
- No new node kinds.
- No semantics changes for existing error/fiber node execution.

## Architecture
- Keep plugin AST emitters in existing `index.ts` files.
- Move runtime handler typing into interpreter modules:
  - `plugins/error/interpreter.ts`: convert to `typedInterpreter` + NodeTypeMap augmentation.
  - `plugins/fiber/interpreter.ts`: convert to `typedInterpreter` + NodeTypeMap augmentation.
  - `plugins/control/interpreter.ts`: new file with typed nodes + typed interpreter + NodeTypeMap augmentation.
- Wire `control` plugin default interpreter to new `controlInterpreter`.

## Runtime Semantics
- `control/each`: evaluate collection; for each item evaluate body nodes with scoped binding for lambda param.
- `control/while`: evaluate condition before each iteration; run loop body nodes sequentially while true.

## Validation
- TDD:
  - Add failing runtime tests for `control` default interpreter behavior.
  - Add failing compile-time type test coverage for typed handlers on `error/fiber/control` kinds.
- Run `pnpm run build && pnpm run check && pnpm run test`.
