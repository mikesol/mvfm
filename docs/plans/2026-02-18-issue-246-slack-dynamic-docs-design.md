# Issue #246: Dynamic Slack Docs Examples — Design

## Problem

The Slack plugin has 271 methods with no documentation examples. Manually writing examples for each is infeasible. The response types are complex (up to 76 nested interfaces per method) and need realistic mock data for the `mockInterpreter` playground feature.

## Approach

Generate all 271 Slack method examples dynamically at Astro build time. No checked-in fixtures or codegen artifacts. The type parser + faker mock generator runs as a normal TypeScript import during `astro build`.

## Architecture

```
packages/docs/src/examples/
├── slack.ts                    ← default export, merges auto + hand-written composed examples
└── slack/
    ├── index.ts                ← generateSlackExamples(): Record<string, NodeExample>
    ├── type-parser.ts          ← TS compiler API: .d.ts file → TypeModel
    ├── mock-generator.ts       ← faker + Lorem Picsum: TypeModel → deterministic JSON
    ├── code-templates.ts       ← generates app → prog → foldAST code strings
    └── field-heuristics.ts     ← fakeString, fakeNumber, singularize, picsum helpers
```

## Build-time flow

1. `slack/index.ts` imports `NODE_TO_METHOD` maps from `@mvfm/plugin-slack` (already exported) to get the full manifest: nodeKind → API method string
2. Derives response type filename from API method: `chat.postMessage` → `ChatPostMessageResponse.d.ts`
3. `type-parser.ts` reads from `node_modules/@slack/web-api/dist/types/response/` — no submodule needed
4. `mock-generator.ts` produces deterministic mock data (faker seed derived from method name)
5. `code-templates.ts` generates the runnable code string
6. Returns `Record<string, NodeExample>` consumed by `getAllExamples()`

## Type source

Parse `.d.ts` files from the npm-installed `@slack/web-api` package (`node_modules/`). These have identical structure to the vendor source `.ts` files but require no submodule initialization. Works in CI and all worktrees.

## Two-tier examples

### Tier 1: Auto-generated (271 methods)

Each method gets a minimal example:

```typescript
const app = mvfm(prelude, console_, slack_);
const prog = app({ channel: "string", text: "string" }, ($) => {
  const result = $.slack.chat.postMessage({
    channel: $.input.channel,
    text: $.input.text,
  });
  return $.begin($.console.log(result), result);
});
await foldAST(
  defaults(app, { slack: mockSlackInterpreter }),
  injectInput(prog, { channel: "C0123456789", text: "Hello from mvfm!" })
);
```

Template needs: accessor path (from nodeKind), required vs optional args, sensible default input values.

### Tier 2: Hand-written (10-20 methods)

Composed examples for common methods that chain operations. These override specific keys in `slack.ts`. Candidates: `chat.postMessage`, `conversations.list`, `conversations.history`, `users.info`, `files.upload`, `reactions.add`.

## mockInterpreter strategy

Each `NodeExample` sets:

```typescript
mockInterpreter: `({ "slack/chat_postMessage": () => (${JSON.stringify(mockResponse)}) })`
```

The playground's `createPlaygroundScope` groups handlers by plugin prefix and injects them as interpreter overrides.

## Mock data generation

- **Deterministic**: faker seed = hash of method name. Same seed always produces same output.
- **Realistic**: field-name heuristics map to faker generators (Slack IDs, timestamps, URLs, names, etc.)
- **Images**: Lorem Picsum URLs at correct dimensions per field (`thumb_64` → `picsum.photos/seed/N/64/64`)
- **Arrays**: Parent field name propagated to elements (`channels: string[]` → channel IDs, not lorem)
- **Enums**: Resolve to real values from the type definition
- **Depth cap**: MAX_DEPTH=5 prevents infinite recursion on deeply nested types
- **Cycle detection**: Visited set per path prevents re-entering the same interface in one branch

## playground-scope.ts changes

Add:
- `slack_` — the slack plugin factory (`import { slack } from "@mvfm/plugin-slack"`)
- `mockSlackInterpreter` — a no-op base interpreter that per-example `mockInterpreter` overrides replace

## Page structure

- One page per method: key `"slack/chat_postMessage"` → URL `/mvfm/slack/chat_postMessage`
- `NamespaceIndex` at `"slack"` with prose about the plugin
- 271 pages total + landing page

## File size

All modules stay under 300 lines:
- `type-parser.ts` ~150 lines
- `mock-generator.ts` ~80 lines
- `field-heuristics.ts` ~150 lines
- `code-templates.ts` ~100 lines
- `slack/index.ts` ~80 lines
- `slack.ts` ~50 lines + composed examples

## Dependencies added to docs package

- `@faker-js/faker` (devDependency)
- `typescript` (already present — needed for TS compiler API)
- `@slack/web-api` (types only, already a transitive dep via `@mvfm/plugin-slack`)

## Spike validation

The spike at `.worktrees/issue-246/packages/plugin-slack/scripts/spike-fastcheck.ts` validated:
- TS compiler API parses all 76 interfaces + 4 enums from the most complex response type
- faker + picsum generates realistic, deterministic mock data
- Field-name heuristics cover Slack IDs, timestamps, URLs, image thumbnails, status fields, channel names
- Array element propagation produces correct typed elements
