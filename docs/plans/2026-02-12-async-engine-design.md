# Async Engine Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the interpreter engine uniformly async, eliminating per-node thenable detection and enabling cross-plugin async composition.

**Problem:** The core interpreter has thenable detection (`typeof result.then === "function"`) copy-pasted across 5 node handlers. This was defensive code added in #25 that is mostly untested. More importantly, it doesn't cover all cases — `buildSQL` in the postgres interpreter silently breaks when `recurse(param)` returns a Promise (e.g., query chaining: `$.sql`INSERT ... ${otherQuery[0].id}``). The root cause is that `recurse` returns `unknown` (might be a value, might be a Promise), and every caller must defensively check.

**Solution:** `recurse` always returns `Promise<unknown>`. All `visit` functions are async. One decision at composition time, uniform behavior everywhere.

---

## 1. Core Engine Change

The `InterpreterFragment` interface becomes async:

```typescript
interface InterpreterFragment {
  pluginName: string;
  canHandle: (node: ASTNode) => boolean;
  visit: (node: ASTNode, recurse: (node: ASTNode) => Promise<unknown>) => Promise<unknown>;
}
```

`composeInterpreters` returns an async function:

```typescript
function composeInterpreters(fragments: InterpreterFragment[]): (node: ASTNode) => Promise<unknown> {
  async function recurse(node: ASTNode): Promise<unknown> {
    const fragment = fragments.find(f => f.canHandle(node));
    if (!fragment) throw new Error(`No interpreter for node kind: ${node.kind}`);
    return await fragment.visit(node, recurse);
  }
  return recurse;
}
```

Every interpreter fragment adds `async` to visit and `await` before every `recurse()` call. The thenable detection in core is replaced by uniform `await`.

## 2. Core Node Semantics

- **`core/do`** — sequential. `await` each step, then `await` the result. This IS sequencing.
- **`core/tuple`** — parallel. `Promise.all(elements.map(el => recurse(el)))`. Elements are independent.
- **`core/record`** — parallel. `Promise.all` the field values, then assemble the object.
- **`core/cond`** — `await` the predicate, then `await` the chosen branch.
- **`core/prop_access`** — `await` the object, access the property.
- **`core/literal`**, **`core/input`**, **`core/lambda_param`** — return immediately.

`buildSQL` in the postgres interpreter also becomes async — `await recurse(param)` for each parameter slot.

## 3. Fiber's New Role

Fiber narrows from "the async plugin" to "the concurrency control plugin."

**Redundant — emit core nodes instead:**
- `fiber/seq` → `$.seq()` emits `core/do` (already sequences)
- `fiber/par` → `$.par()` emits `core/tuple` (already parallelizes via `Promise.all`)

**Kept — genuinely new semantics:**
- `fiber/race` — first to resolve wins
- `fiber/timeout` — time-bounded execution
- `fiber/retry` — retry with delay/backoff
- `fiber/par_map` — batched concurrency control
- `fiber/settle` — collect fulfilled and rejected separately

The fiber plugin's `build()` keeps `$.par()`, `$.seq()`, `$.race()`, etc. as user-facing API, but `$.par()` and `$.seq()` emit core nodes. Fiber interpreter only handles race, timeout, retry, par_map, settle.

## 4. Interpreter Migration

Every interpreter that calls `recurse` gets the mechanical `async`/`await` change:

- **Core** — remove thenable detection (~40 lines), add `async`/`await`, `Promise.all` for tuple/record
- **Num, Str, Eq, Ord** — add `async`/`await` on recurse calls
- **Error** — already async-shaped, add `await` where missing
- **Fiber** — remove seq/par handlers, remaining handlers already Promise-based
- **Postgres** — `buildSQL` becomes async, transaction handlers add `await` on recurse calls

No interpreter logic changes — just async/await plumbing.

## 5. Testing Strategy

**New tests (previously impossible):**
- Query chaining: result of one query as parameter to another
- Cross-plugin chaining: postgres result fed into another plugin
- `core/do` with mixed async steps from different plugins
- `core/record` / `core/tuple` with async values (parallel execution)
- `core/prop_access` on async result (the `order[0].total` pattern)
- `core/cond` with async predicate

**Existing tests:** All 327 should pass unchanged — `run()` functions already `await`.

**Fiber scope tests:** Verify `$.seq()`/`$.par()` emit core nodes. Existing race/timeout/retry/par_map/settle tests pass unchanged.

## 6. Related Issues

- #26 — plugin authoring guide must document the async contract
- #35 — AST node sharing / re-execution (separate concern, not addressed here)
