# Pino Plugin — Design

**Date:** 2026-02-13
**Status:** Approved
**Issue:** #58 (parent: #46)

## Goal

Implement the `pino` plugin modeling [pino](https://github.com/pinojs/pino) v10.3.1 for structured logging. Fire-and-forget log calls as expression-level AST nodes, composed via `$.do()` like all other external-service plugins.

## Version target

pino 10.3.1 (latest stable). Directory: `src/plugins/pino/10.3.1/`.

## API shape

Mirrors real pino 1:1. Six level methods plus `child()` for scoped bindings. Namespace is `$.pino` (consistent with `$.stripe`, `$.postgres`).

```ts
// Real pino
const logger = pino({ level: "info" });
logger.info("hello");
logger.info({ userId: 123 }, "user logged in");
logger.info({ userId: 123 });  // object-only, no message
logger.child({ requestId: "abc" }).warn("slow query");

// Mvfm pino
const p = pino({ level: "info" });
// in program:
$.pino.info("hello");
$.pino.info({ userId: $.input.id }, "user logged in");
$.pino.info({ userId: 123 });  // object-only, no message
$.pino.child({ requestId: $.input.reqId }).warn("slow query");
```

### Argument disambiguation (single-arg heuristic)

Real pino distinguishes `logger.info("msg")` from `logger.info({ key: val })` by argument type. Mvfm uses a build-time heuristic:

- Raw `string` → message (no merge object)
- Raw `object` → merge object (no message)
- `Expr<T>` → treated as message (use 2-arg form for merge object with Expr)

This matches real pino behavior for raw values. The only deviation: if you have a dynamic merge object as an `Expr`, you must use the 2-arg form `$.pino.info(exprObj, exprMsg)` rather than relying on single-arg type inference.

## Directory structure

```
src/plugins/pino/10.3.1/
  index.ts            # PluginDefinition + PinoMethods + PinoConfig
  interpreter.ts      # InterpreterFragment (uniform pino/log effect)
  handler.server.ts   # Server handler wrapping real pino
  handler.client.ts   # Client handler (HTTP proxy)
  client-pino.ts      # SDK adapter wrapping real pino instance

tests/plugins/pino/10.3.1/
  index.test.ts       # AST construction tests
  interpreter.test.ts # Effect-yielding tests with mock handler
  integration.test.ts # Real pino tests
```

## Plugin definition

```ts
export interface PinoConfig {
  level?: string;
  base?: Record<string, unknown>;
}

export interface PinoLogger {
  trace(mergeObject: Expr<Record<string, unknown>> | Record<string, unknown>, msg?: Expr<string> | string): Expr<void>;
  trace(msg: Expr<string> | string): Expr<void>;
  trace(mergeObject: Record<string, unknown>): Expr<void>;  // object-only (raw)
  debug(/* same 3 overloads */): Expr<void>;
  info(/* same */): Expr<void>;
  warn(/* same */): Expr<void>;
  error(/* same */): Expr<void>;
  fatal(/* same */): Expr<void>;
  child(bindings: Expr<Record<string, unknown>> | Record<string, unknown>): PinoLogger;
}

export interface PinoMethods {
  pino: PinoLogger;
}
```

## Node kinds (6)

`pino/trace`, `pino/debug`, `pino/info`, `pino/warn`, `pino/error`, `pino/fatal`

`child()` does not produce its own node kind. It returns a new logger proxy that accumulates bindings. When a child logger's level method is called, the bindings chain is baked into the log node.

Each AST node shape:

```ts
{
  kind: "pino/info",
  level: "info",
  msg: ASTNode | null,
  mergeObject: ASTNode | null,
  bindings: ASTNode[],
  config: PinoConfig,
}
```

## Interpreter

Uniform effect type: `pino/log`. All 6 levels resolve children via `recurse`, then yield one effect:

```ts
{
  type: "pino/log",
  level: "info",
  msg: "user logged in",
  mergeObject: { userId: 123 },
  bindings: [{ requestId: "abc" }],
}
```

## Handlers

**Server handler**: Takes a `PinoClient` interface, calls `client.log(level, bindings, mergeObject, msg)`. Returns `{ value: undefined, state }`.

**Client handler**: Same generic HTTP proxy pattern as stripe — serializes `pino/log` effects and sends to server endpoint.

**SDK adapter** (`client-pino.ts`): Wraps a real pino instance. Reconstructs the child logger chain from bindings, then calls the appropriate level method.

```ts
export interface PinoClient {
  log(level: string, bindings: Record<string, unknown>[], mergeObject?: Record<string, unknown>, msg?: string): Promise<void>;
}
```

## Honest assessment

| Category | Operations |
|----------|-----------|
| **Maps cleanly** | `trace`, `debug`, `info`, `warn`, `error`, `fatal`, `child` — pure fire-and-forget with structured data |
| **Needs deviation** | Single-arg `Expr` always treated as message — use 2-arg form for dynamic merge objects |
| **Can't model** | Transports (runtime stream config), `destination()` (file descriptors), `flush()` (async stream control), redaction (compile-time transform), `isLevelEnabled()` (runtime level check), `silent` level |

## Plugin size

SMALL — 6 log operations + child logger pattern. Fully implemented in one pass.
