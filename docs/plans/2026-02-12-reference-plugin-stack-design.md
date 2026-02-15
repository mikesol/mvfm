# Reference Plugin Stack Design

**Date:** 2026-02-12
**Status:** Design approved, pending implementation
**Depends on:** #19 (typeclass dispatch — complete)

## Problem

The mvfm plugin ecosystem will eventually be built by a swarm of 100+ agents porting thousands of libraries. The first 10-20 reference plugins are the training data for those agents. Every shortcut, inconsistency, or missing abstraction gets amplified at scale. The reference plugins must be pristine: full lifecycle (AST + interpreter + traits + tests), correct composition patterns, and zero prelude-level logic buried in plugin code.

## Scope dividing line

For plugins that track real-world packages (postgres.js, Stripe, Redis, etc.):
- **In scope:** Any operation that is request-response (you send a request, you get data back). Queries, transactions, cursors, COPY, etc.
- **Out of scope:** Push-based operations where the server initiates (LISTEN/NOTIFY, WebSocket subscriptions, etc.)

We are not building an ORM. SQL aggregates, joins, subqueries — these are just strings in tagged templates. The plugin doesn't parse or understand SQL. It constructs parameterized queries and interprets the results.

## Directory structure

All plugins move from flat files to directories with colocated interpreters:

```
src/plugins/
  num/
    index.ts           # PluginDefinition + types
    interpreter.ts     # InterpreterFragment
  str/
    index.ts
    interpreter.ts
  boolean/
    index.ts
    interpreter.ts
  eq/
    index.ts           # no interpreter (delegates to num/eq, str/eq, etc.)
  fiber/
    index.ts
    interpreter.ts     # added when fiber is built out
  error/
    index.ts
    interpreter.ts     # added when error is built out
  control/
    index.ts
    interpreter.ts     # added when control is built out
  st/
    index.ts
    interpreter.ts     # added when st is built out
  postgres/
    3.4.7/
      index.ts         # PluginDefinition targeting postgres.js v3.4.7
      interpreter.ts   # default InterpreterFragment
```

Tests mirror the structure:

```
tests/plugins/
  num/
    index.test.ts
    interpreter.test.ts
  postgres/
    3.4.7/
      index.test.ts
      interpreter.test.ts
```

Unversioned plugins (num, str, boolean, eq, fiber, error, control, st) are mvfm-native — they don't track an external package. Versioned plugins track a specific upstream release. The filesystem is the version registry.

## Interpreter model

### Core principle: composable and swappable

Interpreters are `InterpreterFragment` values composed via `composeInterpreters`. First match wins. Users swap implementations by registering a higher-priority fragment:

```ts
// Default: uses real cursors
const interp = composeInterpreters([coreInterpreter, postgresInterpreter(client)]);

// Custom: translates cursors to OFFSET/LIMIT
const interp = composeInterpreters([cursorViaOffsetInterpreter, coreInterpreter, postgresInterpreter(client)]);
```

### Factory pattern for external dependencies

Plugins that need external resources (database connections, API keys) ship interpreter factories:

```ts
export function postgresInterpreter(client: PostgresClient): InterpreterFragment

export interface PostgresClient {
  query(sql: string, params: unknown[]): Promise<unknown[]>;
  begin<T>(fn: (tx: PostgresClient) => Promise<T>): Promise<T>;
}
```

This means:
- The plugin doesn't import any driver
- Users provide their own client (wrapping pg, postgres.js, Neon, etc.)
- Tests use a mock client — fast, deterministic, no infrastructure

### Mvfm-native plugins

Plugins like num, str, boolean ship plain interpreter fragments (no factory needed — they have no external dependencies).

## Versioning

Plugins that track a real-world package are versioned using the same version as the upstream package they test against. When postgres.js ships v3.5.0, that's a new directory (`postgres/3.5.0/`), not a patch to the existing one.

The version is encoded in the directory path. No version metadata field needed on `PluginDefinition` — the filesystem is the source of truth.

## Trait / prelude rules

### Hard rule: never roll prelude-y stuff into a plugin

If an operation could be useful to more than one plugin, it MUST be its own plugin. This applies to both user-facing API and internal implementation. Examples:

- Equality comparison → `eq` plugin (done)
- Ordering/comparison → `ord` plugin (not yet built)
- Null handling → `nullable` plugin (not yet built)
- String conversion → `show` plugin (not yet built)

When building a plugin and discovering a missing prelude operation, STOP. Create an issue for the prelude plugin. Build it. Resume.

### Why this matters for agents

Agents learn by example. If the postgres interpreter inlines `===` for equality instead of dispatching through the trait system, every agent-generated plugin will do the same. The reference plugins must demonstrate composition at every level.

## Existing plugin disposition

Use existing plugins (fiber, error, control, st) as-is. When the postgres work reveals something broken or inconsistent, fix it then. If a plugin is fundamentally wrong (e.g., control's statement-level design in an expression-level DSL), replace it rather than trying to save it.

## Implementation phases

### Phase A: Directory restructure (separate issue)
- Move all plugins from flat files to directories
- Colocate existing interpreters (num, str, boolean, core)
- Update all imports in src/index.ts and test files
- No behavior changes, just reorganization
- Update exports so public API doesn't change

### Phase B: Postgres reference implementation (blocked by Phase A)
- Cover full request-response surface of postgres.js
- Queries, parameterization, helpers, identifiers, transactions, savepoints, cursors, COPY
- AST construction + interpreter fragment + trait declarations + tests
- Interpreter as factory taking PostgresClient interface
- Mock client for tests
- When missing prelude plugins discovered, stop and build them first

### Phase C: Plugin authoring guide update (after Phase B)
- Update guide to reflect full lifecycle learned from postgres
- Directory conventions, interpreter patterns, trait participation
- Required test patterns (AST + interpretation)
- Prelude rule documentation

## Risks

- Restructure touches every import — high blast radius, but low complexity
- Postgres.js API surface is large — need to be disciplined about scope
- Discovering prelude gaps mid-postgres will create context switches — accept this as part of the organic process
- The mock client pattern may not exercise all edge cases — consider integration test guidance for real databases (separate from unit tests)
