# Default Plugin Interpreters Design

Issue: `#203`
Date: `2026-02-16`

## Problem

Ten plugins currently require boilerplate factory calls for the common case. This adds friction to the normal interpreter assembly flow:

```ts
const interpreter = {
  ...coreInterpreter,
  ...numInterpreter,
  ...strInterpreter,
  ...createConsoleInterpreter(wrapConsole(console)),
};
```

The desired DX is direct spread of a prebuilt default interpreter:

```ts
const interpreter = {
  ...coreInterpreter,
  ...numInterpreter,
  ...strInterpreter,
  ...consoleInterpreter,
};
```

## Scope

Add default interpreters for:

- `plugin-console`
- `plugin-fetch`
- `plugin-pino`
- `plugin-openai`
- `plugin-anthropic`
- `plugin-stripe`
- `plugin-slack`
- `plugin-twilio`
- `plugin-resend`
- `plugin-fal`

No change to plugins that require explicit runtime configuration (`postgres`, `redis`, `s3`, `cloudflare-kv`).

## API Design

Each plugin exports a new default constant from its public `src/index.ts` surface:

- `consoleInterpreter`
- `fetchInterpreter`
- `pinoInterpreter`
- `openaiInterpreter`
- `anthropicInterpreter`
- `stripeInterpreter`
- `slackInterpreter`
- `twilioInterpreter`
- `resendInterpreter`
- `falInterpreter`

Existing `createXInterpreter(...)` factories remain unchanged for custom clients and test injection.

## Default Construction Rules

- `console`: `createConsoleInterpreter(wrapConsole(globalThis.console))`
- `fetch`: `createFetchInterpreter(wrapFetch(globalThis.fetch))`
- `pino`: `createPinoInterpreter(wrapPino(pino()))`
- `openai`: `createOpenAIInterpreter(wrapOpenAISdk(new OpenAI()))`
- `anthropic`: `createAnthropicInterpreter(wrapAnthropicSdk(new Anthropic()))`
- `stripe`: `new Stripe(process.env.STRIPE_API_KEY!)` via wrapper
- `slack`: `new WebClient(process.env.SLACK_BOT_TOKEN!)` via wrapper
- `twilio`: `twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)` via wrapper
- `resend`: `new Resend(process.env.RESEND_API_KEY!)` via wrapper
- `fal`: env-key-based fal client configuration via existing wrapper surface

## Error Handling

For env-dependent defaults, missing required env vars must throw immediately when the module initializes. Error messages should identify:

- plugin name
- missing env var name
- remediation (set env var or use `createXInterpreter`)

This explicit fail-fast behavior was requested.

## Testing Strategy

- Add tests asserting each new `*Interpreter` export is present and can handle at least one representative node kind.
- Add environment validation tests for env-dependent plugins.
  - Use isolated module import patterns to verify throw-on-missing-env at initialization time.
- Keep existing factory tests unchanged to preserve custom-client behavior.

## VISION Alignment

- `VISION.md §1 (DX)`: reduces the default interpreter assembly to low-friction composition with obvious defaults.
- Maintains deterministic AST/interpreter contract by changing only interpreter wiring, not node semantics.

## Non-goals

- No API redesign of plugin DSL builders.
- No changes to plugins where runtime resources are inherently request-scoped or deployment-specific.
- No replacement or deprecation of `createXInterpreter` factories.
