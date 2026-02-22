# Plugin Authoring Guide — External Plugins

Audience: LLM agents generating external plugins (stripe, postgres, fal, openai, etc.).
Scope: External plugins only. Native plugins (num, str, eq) follow different patterns.

---

## 1. Source-Level Analysis

Before writing any code, verify the upstream library's actual API by reading its source.

**Procedure:**

1. Clone the upstream repo at the exact target version into `/tmp`.
2. Read the SOURCE CODE — not docs, not READMEs, not type stubs.
3. Identify the public API surface: methods, parameters, return types, error modes.
4. Assess each operation against this matrix:

| Assessment | Meaning | Action |
|---|---|---|
| Maps cleanly | 1:1 correspondence with a CExpr node | Implement |
| Needs deviation | Semantics require adaptation (e.g., callbacks to scoped nodes) | Document deviation in index.ts header comment |
| Can't model | Operation is inherently non-deterministic or stateful beyond mvfm's model | Omit; document in header comment as deliberate omission |

**Hard stop:** If source code cannot be obtained or verified, implementation MUST NOT proceed.

Document the assessment in the plugin's `index.ts` header comment. Read `packages/plugin-postgres/src/3.4.8/index.ts` lines 1-15 for the reference header format.

---

## 2. The Plugin Contract

Read `packages/core/src/plugin.ts` for the canonical `Plugin` interface.

A plugin is an object with these fields:

| Field | Type | Required | Purpose |
|---|---|---|---|
| `name` | `string` (const) | Yes | Unique plugin identifier; prefixes all node kinds |
| `ctors` | object | Yes | Constructor methods that produce CExpr nodes |
| `kinds` | `Record<string, KindSpec>` | Yes | Exhaustive registry of every node kind the plugin emits |
| `traits` | `Record<string, TraitDef>` | Yes | Trait declarations (empty `{}` if none) |
| `lifts` | `Record<string, string>` | Yes | Type-to-kind lift mappings (empty `{}` if none) |
| `defaultInterpreter` | `() => Interpreter` | No | Factory returning a default interpreter; omit when no sensible default exists |
| `shapes` | `Record<string, unknown>` | No | Structural shape descriptors for validation |

**Critical:** The `kinds` object IS the exhaustive list of node kinds. There is no separate `nodeKinds` field. Every kind key must be prefixed with `{name}/`.

**Configured vs unconfigured:** Most external plugins are configured (factory function taking config, returning Plugin). Read `packages/plugin-stripe/src/2025-04-30.basil/index.ts` for a configured plugin with `defaultInterpreter`. Read `packages/plugin-postgres/src/3.4.8/index.ts` for a configured plugin without `defaultInterpreter`.

**Constructor pattern:** Each constructor method calls `makeCExpr(kind, args)` to produce a CExpr node. Plain object/array arguments are recursively lifted into `{name}/record` and `{name}/array` CExpr nodes via a `liftArg` helper. Config is NOT stored on AST nodes — it is captured by the interpreter closure.

**KindSpec entries:** Each kind declares `inputs` (typed tuple of child types) and `output` (the result type). Use `undefined as unknown` for polymorphic slots. Read `packages/plugin-fal/src/1.9.1/index.ts` for the full pattern.

The factory must end with `satisfies Plugin` to get compile-time validation.

---

## 3. File Patterns

### Simple (request-response)

```
packages/plugin-{name}/src/{version}/
  index.ts           — Plugin factory, constructors, config type
  interpreter.ts     — Client interface, createXxxInterpreter(), handler implementations
  client-{sdk}.ts    — SDK adapter wrapping the real library into the client interface
```

Use when every operation is "resolve params, call client, return result."

References:
- `packages/plugin-stripe/src/2025-04-30.basil/` — stripe (REST API wrapper)
- `packages/plugin-fal/src/1.9.1/` — fal (AI inference endpoints)
- `packages/plugin-twilio/src/5.5.1/` — twilio (messaging API)

### Scoped (transactions/sessions/cursors)

Same as simple, plus:

```
  handler.server.ts  — Server interpreter with scope management (client stacks, cursor bridges)
  handler.client.ts  — Client-side proxy interpreter (sends resolved data to server endpoint)
```

Use when some operations create execution scopes where nested operations must share context (transactions, streaming sessions, cursors).

References:
- `packages/plugin-postgres/src/3.4.8/` — postgres (transactions, savepoints, cursors)
- `packages/plugin-openai/src/6.21.0/` — openai (streaming completions)

---

## 4. Interpreter Pattern

Read `packages/core/src/plugin.ts` for the `Handler` and `Interpreter` type definitions.

**Handler signature:** `async function*(entry: RuntimeEntry) => AsyncGenerator<FoldYield, unknown, unknown>`

**Child resolution:** `yield 0` evaluates the first child and returns its value. `yield 1` evaluates the second, etc. The fold trampoline drives this protocol.

**Leaf nodes:** Access `entry.out` for literal values, `entry.children` for child IDs.

**IO:** All external calls go through an injected client interface. The client is defined in `interpreter.ts` and abstracts over the real SDK. This makes handlers testable with mock clients.

**Interpreter object:** A plain `Record<string, Handler>` mapping kind strings to handler functions. Read `packages/plugin-stripe/src/2025-04-30.basil/interpreter.ts` for the reference pattern.

**`defaultInterpreter`:** Include when a sensible default exists (factory creates SDK client internally from config). The plugin factory's `defaultInterpreter` field is a `() => Interpreter` that lazily creates the client. Read `packages/plugin-stripe/src/2025-04-30.basil/index.ts` lines 72-105 for lazy client wiring.

**No `defaultInterpreter`:** When the plugin requires explicit client setup (e.g., database connections). Export a `createXxxInterpreter(client)` factory instead. Consumers wire it via `defaults(plugins, { pluginName: createXxxInterpreter(client) })`. Read `packages/plugin-postgres/src/3.4.8/handler.server.ts` for the scoped server interpreter pattern.

**Scoped handlers:** For operations that create execution scopes (transactions, cursors), the server interpreter maintains a client stack. Nested operations automatically use the innermost scoped client. Read `packages/plugin-postgres/src/3.4.8/handler.server.ts` for the client-stack pattern.

**Interpreter composition:** Use `defaults()` from `packages/core/src/fold.ts` to merge interpreters from all plugins, with per-plugin overrides for plugins lacking `defaultInterpreter`.

---

## 5. Tests

Three tiers, all required for external plugins.

### Tier 1: AST Construction

Verify that constructor methods produce CExpr nodes with correct `__kind` and `__args`.

- Instantiate the plugin, call each constructor, assert on `__kind` and argument structure.
- Verify all kinds are namespaced (`plugin/kind`).
- Verify the Plugin shape: `name`, `kinds` count, `traits`, `lifts`, `defaultInterpreter`.

Reference: `packages/plugin-stripe/tests/2025-04-30.basil/index.test.ts`

### Tier 2: Interpretation (Mock Client)

Verify that handlers call the client interface correctly and return expected results.

- Create a mock client that captures calls.
- Wire it via `createXxxInterpreter(mockClient)`.
- Use `defaults(plugins, { name: createXxxInterpreter(mockClient) })` to compose.
- Run `fold(app(expr), interp)` and assert on captured calls and return values.

Reference: `packages/plugin-stripe/tests/2025-04-30.basil/interpreter.test.ts`

### Tier 3: Integration

Verify end-to-end behavior against a real or containerized service.

- Use testcontainers or equivalent for databases/services.
- For API services, use sandbox/test credentials.
- Test actual round-trip behavior, not just mock responses.

Reference: `packages/plugin-stripe/tests/2025-04-30.basil/integration.test.ts`

| Service type | Container/approach |
|---|---|
| PostgreSQL | `@testcontainers/postgresql` or PGLite |
| Redis | `@testcontainers/redis` |
| S3 | MinIO via testcontainers |
| HTTP APIs | Sandbox credentials (Stripe test keys, etc.) |

---

## 6. Standing Rules

1. **Namespace node kinds.** Every kind must be `{pluginName}/{operation}`. Never bare `kind`.
2. **`kinds` must be exhaustive.** Every kind the plugin can emit must appear in the `kinds` object, including structural helpers like `{name}/record` and `{name}/array`.
3. **Constructors are pure.** No side effects, no IO, no SDK calls at build time. They only produce CExpr nodes.
4. **Interpreters compose via `defaults()` or object spread.** Never modify another plugin's interpreter. Read `packages/core/src/fold.ts` lines 249-266 for the `defaults()` implementation.
5. **Every public export gets TSDoc.** Types, interfaces, functions, and consts exported from `src/index.ts`.
6. **Every node kind needs a docs example.** See Section 7.
7. **Reusable logic becomes its own plugin.** If an operation could be useful to more than one plugin, it MUST be a separate plugin. Do not inline generic logic into a domain plugin.
8. **Files under 300 lines.** Split into focused modules when approaching the limit.

---

## 7. Docs Examples

Every node kind needs an entry in `packages/docs/src/examples/{plugin-name}.ts`.

Read `packages/docs/src/examples/types.ts` for the `NodeExample` type definition.

Each entry is a `Record<string, NodeExample>` with `export default`. Required fields: `description` (one-line), `code` (executable playground code).

External plugins must include `plugins: ["@mvfm/plugin-name"]` in each example entry.

Plugins without a `defaultInterpreter` must have their interpreter factory added to `packages/docs/src/playground-scope.ts` and provide `mockInterpreter` in example entries.

Every example must follow the full execution pipeline: construct AST via `app()`, execute via `fold()`. Examples that only construct AST without executing are bugs.

Reference: `packages/docs/src/examples/stripe.ts`
