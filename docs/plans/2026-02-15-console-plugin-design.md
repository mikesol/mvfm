# Console Plugin Design (Issue #184)

## Objective
Implement a new `@mvfm/plugin-console` package that provides full Node `console` API coverage in the MVFM DSL, following `docs/plugin-authoring-guide.md` and the plugin contract (`name`, `nodeKinds`, `build(ctx)`).

## Scope
- Full coverage methods:
  - `assert`, `clear`, `count`, `countReset`, `debug`, `dir`, `dirxml`, `error`, `group`, `groupCollapsed`, `groupEnd`, `info`, `log`, `table`, `time`, `timeEnd`, `timeLog`, `trace`, `warn`
- Include all required plugin layers:
  - Builder API (`index.ts`)
  - Interpreter fragment (`interpreter.ts`)
  - Server/client handlers (`handler.server.ts`, `handler.client.ts`)
  - Runtime adapter over global console (`client-console.ts`)
- Export top-level API via `src/index.ts`
- Add complete test coverage:
  - AST construction tests
  - Interpreter effect tests
  - Integration tests (against captured console runtime)

## Architecture
Use the same external-plugin package pattern as `plugin-pino`:
- Package: `packages/plugin-console`
- Versioned implementation dir: `src/22.0.0`
- One namespaced node kind per method (`console/<method>`)
- Interpreter maps all console nodes to yielded effects (`console/<method>`)
- Server handler calls a `ConsoleClient` adapter
- Integration tests validate actual runtime behavior via a test double that captures method calls

This keeps parity with existing plugins and makes “100% coverage” auditable by:
- Exhaustive `nodeKinds`
- Method-by-method tests
- End-to-end effect execution checks

## API Shape
DSL surface:
- `$.console.<method>(...)` for every method listed above

Argument conventions (Node-style)
- Variadic methods (`log`, `info`, `warn`, `error`, `debug`, `trace`, `dirxml`, `group`, `groupCollapsed`, `timeLog`, `table`) accept `...args`
- Label methods (`count`, `countReset`, `time`, `timeEnd`) accept optional label
- `clear`, `groupEnd` take no args
- `assert` accepts `(condition, ...data)`
- `dir` supports `(item, options?)`

All args accept `Expr<T> | T` equivalents and are lifted with `ctx.lift`.

## Error Handling
- Builder performs no runtime validation beyond typing and AST construction.
- Interpreter is deterministic and only yields `console/*` effects.
- Server handler throws on unknown effect types.
- Adapter throws when asked for an unsupported method (defensive guard).

## Testing Strategy
1. AST tests verify every method produces the correct `console/<method>` node and captures args.
2. Interpreter tests verify each node yields expected effect payloads with resolved args.
3. Integration tests verify handler+adapter invoke underlying console methods with exact argument propagation.

## Why This Design
- Preserves plugin-authoring guide constraints.
- Maximizes maintainability and explicitness for full coverage.
- Keeps behavior deterministic and inspectable at AST/effect layers.
- Avoids ambiguous “generic call” nodes that weaken static coverage guarantees.
