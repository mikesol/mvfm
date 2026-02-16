# `defaults(app)` — Derive Interpreter from App

Issue: `#207`
Date: `2026-02-16`

## Problem

Even with default interpreters from #205, users must manually spread every interpreter for every plugin in their app. Nobody will remember (or want to) type:

```ts
const interpreter = {
  ...coreInterpreter,
  ...numInterpreter,
  ...strInterpreter,
  ...ordInterpreter,
  ...booleanInterpreter,
  ...consoleInterpreter,
};
```

## Desired API

```ts
const app = mvfm(prelude, console_);
const prog = app({ n: "number" }, ($) => $.add($.input.n, 2));
const interpreter = defaults(app);
await foldAST(interpreter, prog);
```

For apps that include plugins without obvious defaults (postgres, redis, etc.):

```ts
const app = mvfm(prelude, postgres(url));
const interpreter = defaults(app, { postgres: pgInterpreter });
```

Overrides can also replace plugins that DO have defaults (useful for testing):

```ts
const interpreter = defaults(app, { console: mockConsoleInterpreter });
```

## Design

### 1. New optional field on `PluginDefinition`

Add `defaultInterpreter` to the plugin contract:

```ts
interface PluginDefinition<T = any, Traits = {}> {
  name: string;
  nodeKinds: string[];
  build: (ctx: PluginContext) => T;
  traits?: { ... };
  defaultInterpreter?: Interpreter;  // NEW
}
```

Plugins with obvious defaults populate this field. Plugins without it (postgres, redis, s3, cloudflare-kv) leave it absent.

### 2. Expose resolved plugins on `mvfm()` return value

Currently `mvfm()` returns a bare `define` function. Change it to return a callable object with a `.plugins` property:

```ts
interface MvfmApp<P extends readonly PluginInput[]> {
  // the define overloads (schema + fn, or just fn)
  <S extends SchemaShape>(schema: S, fn: ...) => Program;
  <I = never>(fn: ...) => Program;
  // resolved plugin definitions — used by defaults()
  readonly plugins: FlattenPluginInputs<P>;
}
```

This is a non-breaking change: existing code calling `app(($) => ...)` still works because the object is callable.

### 3. Type-safe `defaults()` function

The key insight: TypeScript can structurally distinguish plugins that have `{ defaultInterpreter: Interpreter }` from those that don't. This enables compile-time enforcement of required overrides.

**Type helpers:**

```ts
// Does this plugin have a default?
type HasDefault<P> = P extends { defaultInterpreter: Interpreter } ? true : false;

// Which plugin names need overrides?
type OverrideKeys<Plugins> = /* names of plugins where HasDefault is false */

// All plugin names (for optional overrides)
type AllPluginNames<Plugins> = /* all plugin name literals */

// Required overrides + optional overrides for defaults
type OverridesMap<Plugins> =
  { [K in OverrideKeys<Plugins>]: Interpreter } &
  { [K in Exclude<AllPluginNames<Plugins>, OverrideKeys<Plugins>>]?: Interpreter };
```

**Signature:**

```ts
// When all plugins have defaults: overrides is optional
// When some plugins lack defaults: overrides is required with exactly those keys
function defaults<P extends readonly PluginInput[]>(
  app: MvfmApp<P>,
  ...args: DefaultsArgs<FlattenPluginInputs<P>>
): Interpreter;
```

**Compile-time behavior (validated by spike):**

| Call | Result |
|------|--------|
| `defaults(app)` where all plugins have defaults | Compiles |
| `defaults(app)` where postgres lacks default | Error: "Expected 2 arguments, but got 1" |
| `defaults(app, { postgres: pgInterp })` | Compiles |
| `defaults(app, { postgres: pgInterp, console: mock })` | Compiles (optional override) |
| `defaults(app, { bogus: interp })` | Error: "'bogus' does not exist in type" |
| `defaults(app, { postgres: pgInterp })` but redis also missing | Error: "Property 'redis' is missing" |

### 4. Runtime behavior

`defaults()` at runtime:

1. Starts with `coreInterpreter` as the base (core/* nodes are always present)
2. Iterates `app.plugins`
3. For each plugin: uses the override if provided, else uses `plugin.defaultInterpreter`, else throws
4. Spreads all handlers into a single `Interpreter` object
5. Returns the composed interpreter

Plugins with `nodeKinds: []` (typeclasses like semiring, show, monoid, etc.) contribute nothing to the interpreter and are skipped.

### 5. Changes to existing plugins

Each plugin that already exports a `*Interpreter` const (from #205) adds `defaultInterpreter` to its `PluginDefinition`:

- **Core plugins**: num, str, boolean, eq, ord (pure — no client needed)
- **External plugins with env-based defaults**: console, fetch, pino, openai, anthropic, stripe, slack, twilio, resend, fal
- **Typeclass plugins**: semiring, show, monoid, etc. — `nodeKinds: []`, no interpreter needed, no field added
- **No-default plugins**: postgres, redis, s3, cloudflare-kv — field absent, override required

## VISION Alignment

- **§1 DX**: Reduces the 4-step flow to minimal boilerplate. `defaults(app)` is one line instead of N spreads.
- **§3 Plugins**: Plugin contract gains one optional field. Non-breaking. Existing plugins without defaults continue to work — users just must provide overrides.

## Non-goals

- No change to `foldAST` or `typedFoldAST` signatures.
- No change to `Program` type.
- No deprecation of manual interpreter spreading — `defaults()` is sugar, not a replacement.
- No change to `createXInterpreter` factory functions.
