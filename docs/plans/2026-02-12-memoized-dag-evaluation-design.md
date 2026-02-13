# Memoized DAG Evaluation Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate redundant re-execution of shared AST nodes by adding memoized DAG evaluation to the interpreter.

**Problem:** The AST is structurally a DAG (multiple paths reference the same node), but the interpreter traverses it as a tree — re-evaluating shared nodes every time they're encountered. This causes duplicate query execution, wasted computation, and incorrect behavior in callback patterns (cursor, par_map) where `structuredClone` breaks node identity.

**Architecture:** WeakMap-based memoization in `composeInterpreters` with taint tracking for volatile nodes. No AST surface changes. Internal to the interpreter.

---

## 1. Core Memoization

`composeInterpreters` creates a `WeakMap<ASTNode, Promise<unknown>>` and a `WeakSet<ASTNode>` (taint set). The `recurse` function checks the cache before evaluating any node.

```typescript
export function composeInterpreters(
  fragments: InterpreterFragment[],
): RecurseFn {
  const cache = new WeakMap<ASTNode, Promise<unknown>>();
  const tainted = new WeakSet<ASTNode>();

  async function recurse(node: ASTNode): Promise<unknown> {
    if (!tainted.has(node)) {
      const cached = cache.get(node);
      if (cached !== undefined) return cached;
    }

    const fragment = fragments.find((f) => f.canHandle(node));
    if (!fragment) throw new Error(`No interpreter for node kind: ${node.kind}`);

    const promise = fragment.visit(node, recurse);

    // Optimistically cache the promise (for concurrent dedup via Promise.all)
    if (!isVolatile(node)) cache.set(node, promise);

    const result = await promise;

    // Post-evaluation: check if any child AST node is tainted
    if (isVolatile(node) || hasAnyTaintedChild(node, tainted)) {
      tainted.add(node);
      cache.delete(node); // remove optimistic entry
    }

    return result;
  }

  recurse.fresh = () => composeInterpreters(fragments);

  return recurse as RecurseFn;
}
```

Key details:
- **Promise is cached, not the resolved value.** Concurrent access (e.g., `Promise.all` in `core/tuple`) gets the same promise — natural dedup.
- **Optimistic caching** before taint check: promise stored immediately so concurrent access during evaluation is safe. Removed if tainted.
- `WeakMap` keyed on object identity = O(1) amortized lookup, zero GC pressure.

## 2. Taint Propagation

Taint starts at volatile nodes and propagates upward through evaluation.

```typescript
function isVolatile(node: ASTNode): boolean {
  return node.kind === "core/lambda_param" || node.kind === "postgres/cursor_batch";
}

function hasAnyTaintedChild(node: ASTNode, tainted: WeakSet<ASTNode>): boolean {
  for (const value of Object.values(node)) {
    if (value !== null && typeof value === "object") {
      if (isASTNode(value) && tainted.has(value)) return true;
      if (Array.isArray(value)) {
        for (const item of value) {
          if (isASTNode(item) && tainted.has(item)) return true;
        }
      }
    }
  }
  return false;
}

function isASTNode(value: unknown): value is ASTNode {
  return typeof value === "object" && value !== null && "kind" in value
    && typeof (value as any).kind === "string";
}
```

Trace through cursor with external config query:

```
Iteration 1:
  cursor_batch       → volatile → tainted, NOT cached
  prop_access [0]    → child tainted → tainted, NOT cached
  prop_access .data  → child tainted → tainted, NOT cached
  SELECT tax_rate    → no tainted children → CACHED
  prop_access [0]    → no tainted children → CACHED
  prop_access .rate  → no tainted children → CACHED
  INSERT query       → has tainted param → tainted, NOT cached

Iteration 2:
  cursor_batch       → volatile, re-evaluated with new batch
  prop_access [0]    → tainted, re-evaluated
  prop_access .data  → tainted, re-evaluated
  SELECT tax_rate    → CACHE HIT, no re-execution ✓
  prop_access .rate  → CACHE HIT ✓
  INSERT query       → tainted, re-evaluated with new data ✓
```

## 3. Scoped Evaluation for Retry

Retry needs fresh evaluation per attempt (external world may have changed). The `recurse` function exposes a `.fresh()` method that creates a new recurse with empty cache and taint set.

```typescript
export interface RecurseFn {
  (node: ASTNode): Promise<unknown>;
  fresh(): RecurseFn;
}
```

The `InterpreterFragment.visit` signature is unchanged — `(node: ASTNode, recurse: (node: ASTNode) => Promise<unknown>) => Promise<unknown>`. Only `fiber/retry` casts to access `.fresh()`:

```typescript
case "fiber/retry": {
  const attempts = node.attempts as number;
  const delay = (node.delay as number) ?? 0;
  const freshRecurse = (recurse as RecurseFn).fresh;
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await freshRecurse()(node.expr as ASTNode);
    } catch (e) {
      lastError = e;
      if (i < attempts - 1 && delay > 0) {
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}
```

Each attempt gets a completely fresh cache. A cached rejected promise from attempt 1 is gone by attempt 2.

## 4. Cursor Without Cloning

Stop using `structuredClone` in the cursor handler. Instead, set `__batchData` on the cursor_batch node directly before each iteration. Taint tracking ensures batch-dependent nodes re-evaluate while stable nodes hit the cache.

```typescript
// Before:
await client.cursor(sql, params, batchSize, async (rows) => {
  const bodyClone = structuredClone(node.body) as ASTNode;
  injectCursorBatch(bodyClone, rows);
  await recurse(bodyClone);
  return undefined;
});

// After:
const batchNode = findCursorBatch(node.body as ASTNode);
await client.cursor(sql, params, batchSize, async (rows) => {
  (batchNode as any).__batchData = rows;
  await recurse(node.body as ASTNode);
  return undefined;
});
```

`injectCursorBatch` (recursive tree walker) replaced by `findCursorBatch` (locate once upfront). Iterations are sequential so mutating `__batchData` is safe.

**Par_map keeps cloning.** Items run concurrently via `Promise.all` — cloning is the simplest way to keep them independent. Known limitation: shared external nodes inside par_map bodies are re-evaluated per item (clones have different identity). A future binding-environment approach would fix this.

## 5. What Stays the Same

- **par_map**: keeps `structuredClone` (concurrent safety)
- **error/catch**: keeps `injectLambdaParam` mutation (single evaluation, no re-execution issue)
- **InterpreterFragment interface**: `visit` signature unchanged
- **AST surface**: no new node kinds, no structural changes
- **Plugin contract**: unaffected — plugins don't see the cache

## 6. Testing Strategy

### Basic DAG tests

1. **Shared query, two consumers** — config query used by both `a` and `b` in `$.do(a, b)`. Assert config executes once (mock client tracks call count).
2. **Diamond dependency** — A depends on B and C, both depend on D. Assert D executes once.
3. **Parallel tuple with shared node** — `$.par(f(shared), g(shared))`. Assert shared query executes once despite `Promise.all`.

### Cursor tests

4. **Cursor with external query** — config query outside cursor body, used inside. Assert runs once across N batch iterations.
5. **Cursor with mixed branches** — body uses both `batch[0].x` and `config[0].y`. Assert config cached, batch re-evaluated.
6. **Nested cursor** — cursor inside cursor with independent batches.

### Retry tests

7. **Retry re-executes each attempt** — query fails twice then succeeds. Assert called 3 times.
8. **Retry inside do with shared node** — outer `$.do` has config query, inner retry also uses it. Assert retry re-evaluates independently.

### Adversarial tests

9. **Cursor inside retry** — retry wraps cursor. Attempt 1 fails. Attempt 2 re-runs entire cursor with fresh cache.
10. **Same node in tainted and untainted positions** — query used both inside cursor body and outside. Assert cached for outside, taint works for inside.
11. **Long prop_access chain** — `config[0].items[0].name`. Assert full chain cached.
12. **Par_map with shared external query** — document as known limitation: cloning defeats memoization for shared external nodes in par_map bodies.
