# Ilo — Vision 0.2.0

*Extensible tagless final DSL for deterministic, verifiable TypeScript programs.*

*Toki Pona "ilo": tool. A tool that builds tools — composable, inspectable, inert until interpreted.*

---

## 1. What Ilo Is

Ilo is a **library** for building programs that are data. You compose a set of plugins, write a closure, and get back a deterministic AST with a content hash. Nothing executes. The AST is a complete, self-contained description of what the program *would* do — an interpreter gives it meaning.

```ts
const serverless = ilo(num, str, postgres('postgres://...'), fiber, error)

const getUser = serverless(($) => {
  const user = $.sql`select * from users where id = ${$.input.userId}`
  return $.do(
    $.sql`update users set last_seen = now() where id = ${$.input.userId}`,
    user[0]
  )
})
// getUser is a Program: { ast, hash, plugins, inputSchema }
```

The `$` object is assembled from plugins. Each plugin contributes methods, AST node kinds, and TypeScript types. The closure runs once at build time, constructing a tree via Proxy interception. The result is a `Program` — a JSON-serializable AST plus a deterministic hash.

---

## 2. Core Principles

**1. Programs are data.** A program is an AST, not an execution. You can serialize it, hash it, diff it, send it over the wire, store it in a database, or feed it to an LLM. The AST is the program.

**2. Side effects are explicit.** Every expression that does something (DB write, API call, KV mutation) must appear in the return tree via `$.do()`. The build phase runs reachability analysis and rejects orphaned side-effecting nodes. If you created it but didn't return it, that's a bug.

**3. Plugins are the only extension mechanism.** There are no hooks, middleware, lifecycle events, or monkey-patching. To add capability to `$`, you write a plugin: `{ name, nodeKinds, build(ctx) }`. Plugins compose via `ilo(a, b, c(...))`.

**4. The interpreter is someone else's problem.** Ilo produces ASTs. Execution is the interpreter's job. An interpreter can target Cloudflare Workers, a local Node process, a test harness, or a visual debugger. Ilo doesn't care. It ships `composeInterpreters()` as a convenience, not a requirement.

**5. LLM-first authorship.** The DSL is designed so that an LLM can generate correct programs from natural language. Plugin methods accept `Expr<T> | T` (auto-lifting raw values). Proxy-based property access means `user.firstName` just works. Error messages explain what went wrong and how to fix it, with code examples.

---

## 3. Architecture in Brief

### Expr\<T\> — Phantom-typed proxies

Every value in the DSL is an `Expr<T>`. At the type level, `T` carries the phantom type for IDE completions and type checking. At runtime, `Expr<T>` is a Proxy that intercepts property access (`core/prop_access`), method calls (`core/method_call`), and array operations — building AST nodes as you go.

### AST nodes — Kind-discriminated records

Every node has a `kind` string namespaced to its plugin: `core/literal`, `num/add`, `db/one`, `stripe/charge`. Nodes carry their operands as nested AST references. The full tree is JSON-serializable.

### Plugin contract

A plugin provides three things:
- **`name`** — unique namespace prefix (e.g. `"stripe"`)
- **`nodeKinds`** — all AST node kinds it emits (e.g. `["stripe/charge", "stripe/refund"]`)
- **`build(ctx)`** — receives a `PluginContext` and returns the methods/properties added to `$`

The `PluginContext` provides: `expr<T>(node)` to create Exprs, `lift(value)` to auto-lift primitives, `isExpr(value)` to detect existing Exprs, `emit(node)` for statement-level nodes, and `statements` for the current statement list.

See `src/plugin-authoring-guide.ts` for a complete worked example.

### Reachability analysis

After the closure executes, ilo walks the return tree and all emitted statements. Any registered node not reachable from the root is an orphan — likely a forgotten side effect. The build fails with a diagnostic error listing the orphaned nodes.

### Recursion via Y combinator

The DSL needs recursion for tree traversal, recursive data processing, and any program that can't be expressed as a flat map/filter/reduce. Native JS recursion doesn't work — a function calling itself would re-execute the closure and build a new AST.

The approach: a Y combinator injected into the AST. `$.rec((self, n) => ...)` where `self` is a function that produces `core/rec_call` nodes and `n` is the input parameter. The recursive call becomes an AST node referencing the enclosing `core/rec` by ID, and the interpreter implements the actual recursion. This keeps the AST finite and inspectable even for recursive programs.

**Status:** Implemented. `$.rec()` produces `core/rec` and `core/rec_call` nodes.

### Content hashing

The AST (with internal IDs stripped) is hashed to produce a deterministic program fingerprint. Identical programs produce identical hashes regardless of when or where they were built.

---

## 4. What Ilo Is NOT

- **Not a runtime.** Ilo produces ASTs. It does not execute them.
- **Not a framework.** There is no application lifecycle, no middleware stack, no request/response model. Ilo is a library you call.
- **Not an ORM.** The `postgres` plugin builds AST nodes containing SQL strings. It doesn't generate queries, manage connections, or migrate schemas.
- **Not a compiler.** There is no codegen step. The output is a runtime JavaScript object (`Program`) that you can inspect, serialize, or hand to an interpreter.

---

## 5. Current Plugins

### Structural plugins

| Plugin | Namespace | What it adds to $ |
|--------|-----------|-------------------|
| `num` | `num/` | Arithmetic (`add`, `sub`, `mul`, `div`, `mod`), comparison (`gt`, `gte`, `lt`, `lte`), rounding (`floor`, `ceil`, `round`, `abs`), variadic (`min`, `max`), negation |
| `str` | `str/` | Tagged template `` $.str`...` ``, `concat`, `upper`, `lower`, `trim`, `slice`, `includes`, `startsWith`, `endsWith`, `split`, `join`, `replace`, `len` |
| `fiber` | `fiber/` | Concurrency primitives. Parallel execution (`par` — tuple and bounded map forms), sequential (`seq`), first-wins (`race`), `timeout` with fallback, `retry` with attempts/delay. Concurrency limits are always explicit. |
| `error` | `error/` | Structured error handling. `try`/`.catch`/`.match`/`.finally`, explicit failure (`fail`), default-on-error (`orElse`), Either-style (`attempt`), assertions (`guard`), collect-all (`settle`). |

### Real-world plugins

Real-world plugins mirror specific, widely-used libraries. An LLM (or developer) who knows the target library should be able to write Ilo programs with near-zero learning curve.

| Plugin | Namespace | Models | What it adds to $ |
|--------|-----------|--------|-------------------|
| `postgres` | `postgres/` | [postgres.js](https://github.com/porsager/postgres) | Tagged template queries (`` $.sql`...` ``), dynamic identifiers (`$.sql.id()`), insert/set helpers (`$.sql.insert()`, `$.sql.set()`), transactions (`$.sql.begin()`), savepoints. **Not supported:** cursors, streaming, COPY, LISTEN/NOTIFY. |

### Planned real-world plugins

These don't exist yet. Each should mirror a specific real-world library as closely as the DSL allows.

| Target | Library to model | Notes |
|--------|-----------------|-------|
| MySQL | mysql2 or similar | Same approach as postgres — tagged templates where possible |
| SQLite | better-sqlite3 or similar | Sync API maps well to DSL |
| Redis | ioredis or similar | Replaces the removed generic `kv` plugin |
| HTTP | fetch / axios | Replaces the removed generic `api` plugin |
| JWT | jose | Replaces the removed generic `jwt` plugin |
| Web Crypto | Web Crypto API | Replaces the removed generic `crypto` plugin |

### Composition model

Plugins don't depend on each other. They compose at the user level:

```ts
const app = ilo(num, str, postgres('postgres://...'), fiber, error)
```

The resulting `$` is the intersection of all plugin contributions. A `postgres/query` node can be wrapped in `fiber/retry`, which can be wrapped in `error/try` — the AST captures the full structure. This is a monad stack without the ceremony:

```
Layer       Plugin     Provides           PureScript equivalent
─────       ──────     ────────           ─────────────────────
pure        core       $.do, $.cond       Identity
concurrency fiber      $.par, $.retry     Aff
failure     error      $.try, $.guard     ExceptT
database    postgres   $.sql`...`         postgres FFI
```

---

## 6. Testing Philosophy

### Framework

Vitest. No alternatives considered — it's the standard for modern TS projects.

### Two categories of tests

**1. Parity tests** — for plugins that model real-world systems. The `postgres` plugin models the postgres.js API. Tests should verify that every pattern in the "Honest Assessment Matrix" (documented in the plugin source) produces the correct AST shape. If postgres.js supports `sql.begin(sql => [...])`, the ilo equivalent must produce a `postgres/begin` node with `mode: "pipeline"`. The matrix documents what works, what's different, and what's unsupported — tests encode that matrix.

**2. Structural tests** — for plugins with no real-world analogue. `fiber` and `error` are structural (concurrency and error handling aren't "copying" a specific library). Tests verify AST shape, composition behavior, and reachability analysis. Example: `$.par(a, b)` inside `$.try().catch()` must produce the right nesting.

### What tests are NOT

Tests do not execute programs. There is no interpreter in the test suite. Tests verify that the AST builder produces the right tree — not that some interpreter does the right thing with it.

---

## 7. File Organization

```
src/
├── core.ts                    — Expr, ASTNode, ilo(), plugin contract
├── plugins/
│   ├── num.ts                 — arithmetic, comparison, rounding
│   ├── str.ts                 — string ops, tagged templates
│   ├── fiber.ts               — concurrency primitives
│   ├── error.ts               — structured error handling
│   ├── postgres.ts            — postgres.js-compatible
│   └── (future real-world plugins: mysql, redis, fetch, jose, webcrypto)
├── plugin-authoring-guide.ts  — worked example (stripe)
└── index.ts                   — public API re-exports
tests/
├── core.test.ts               — reachability, hashing, $.do, $.cond, $.let, $.each
├── plugins/
│   ├── postgres.test.ts       — parity tests against postgres.js API
│   ├── fiber.test.ts          — structural tests for concurrency
│   ├── error.test.ts          — structural tests for error handling
│   └── ...
└── composition.test.ts        — cross-plugin composition (postgres+fiber+error)
```

Demos live in a `demos/` directory or are replaced entirely by tests. The current `demo.ts`, `postgres-demo.ts`, `fiber-demo.ts`, `error-demo.ts` files served their purpose during prototyping but should migrate to test assertions.

---

## 8. Documentation

Astro with Starlight. Covers:

- **Getting started** — install, first program, what comes out
- **Plugin API** — how to write a plugin, the `PluginContext` contract, worked example
- **Built-in plugins** — one page per plugin with real-world examples
- **Interpreter contract** — what an interpreter receives, how to write one
- **Design rationale** — why tagless final, why proxies, why no runtime

**Status:** Not yet implemented.
