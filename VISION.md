# Ilo — Vision 0.1.0

*Extensible tagless final DSL for deterministic, verifiable TypeScript programs.*

*Toki Pona "ilo": tool. A tool that builds tools — composable, inspectable, inert until interpreted.*

---

## 1. What Ilo Is

Ilo is a **library** for building programs that are data. You compose a set of plugins, write a closure, and get back a deterministic AST with a content hash. Nothing executes. The AST is a complete, self-contained description of what the program *would* do — an interpreter gives it meaning.

```ts
const serverless = ilo(num, str, db('postgres://...'))

const getUser = serverless(($) => {
  const user = $.db.one('SELECT * FROM users WHERE id = $1', [$.input.userId])
  return $.do(
    $.db.exec('UPDATE users SET last_seen = now() WHERE id = $1', [$.input.userId]),
    user
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

### Content hashing

The AST (with internal IDs stripped) is hashed to produce a deterministic program fingerprint. Identical programs produce identical hashes regardless of when or where they were built.

---

## 4. What Ilo Is NOT

- **Not a runtime.** Ilo produces ASTs. It does not execute them.
- **Not a framework.** There is no application lifecycle, no middleware stack, no request/response model. Ilo is a library you call.
- **Not an ORM.** The `db` plugin builds AST nodes containing SQL strings. It doesn't generate queries, manage connections, or migrate schemas.
- **Not a compiler.** There is no codegen step. The output is a runtime JavaScript object (`Program`) that you can inspect, serialize, or hand to an interpreter.

---

## 5. Current Plugins

| Plugin | Namespace | What it adds to $ |
|--------|-----------|-------------------|
| `num` | `num/` | Arithmetic, comparison, rounding |
| `str` | `str/` | String ops, template literals, split/join |
| `db` | `db/` | SQL queries (`one`, `many`, `exec`) |
| `api` | `api/` | HTTP methods (`get`, `post`, `put`, `delete`) |
| `jwt` | `jwt/` | Token verification, claims, role checking |
| `crypto` | `crypto/` | SHA-256, SHA-512, HMAC |
| `kv` | `kv/` | Key-value store (get, set, del, incr) |
| `postgres` | `postgres/` | PostgreSQL-specific (transactions, listen/notify) |
| `fiber` | `fiber/` | Structured concurrency (spawn, race, all, timeout) |
| `error` | `error/` | Error handling (tryCatch, throw, assert) |
