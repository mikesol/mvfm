# DAG Model Port to Core — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace core's nested TypedNode tree model with the koan-proven DAG adjacency map model, rewrite foldAST as fold() over NExpr.

**Architecture:** Koans 00-14 are the immutable foundation imported verbatim. Core wraps them thinly. fold() is rewritten from scratch using koan 15 as sketch, adding ST/error/fiber/lambda support. Builder produces CExprs via content-addressed construction, normalizes via app(). Entire Proxy/Expr<T> system deleted.

**Tech Stack:** TypeScript (strict, ES2022), vitest for tests, biome for linting.

**Design doc:** `docs/plans/2026-02-19-issue-290-dag-model-port-design.md`

**Halt protocol:** If any step reveals that a core feature can't be expressed by koan primitives, STOP. Comment on #290 with: what failed, which koan is insufficient, what the feature needs. Don't modify koans, don't force workarounds.

---

### Task 1: Create worktree and branch

**Step 1: Create worktree**
```bash
cd /home/mikesol/Documents/GitHub/ilo/ilo
git worktree add .worktrees/issue-290 -b issue-290 spike-koans-baseline
```

**Step 2: Assign issue**
```bash
gh issue edit 290 --add-assignee @me --remove-label ready --add-label in-progress
```

**Step 3: Verify build works in worktree**
```bash
cd .worktrees/issue-290
npm run build && npm run check && npm test
```

**Step 4: Commit nothing yet — just verify baseline**

---

### Task 2: Copy koans 00-14 into core

**Files:**
- Create: `packages/core/src/dag/00-expr.ts` through `packages/core/src/dag/14-pipe.ts`
- Create: `packages/core/src/dag/index.ts` (barrel)

**Step 1: Create dag directory and copy files**

Copy from `spike-koans/` to `packages/core/src/dag/` with these renames:
```
00-expr.ts      → 00-expr.ts
01-increment.ts → 01-increment.ts
02-build.ts     → 02-build.ts
03-normalize.ts → 03-normalize.ts
04-predicates.ts → 04-predicates.ts
05-select.ts    → 05-select.ts
06-map.ts       → 06-map.ts
07-replace.ts   → 07-replace.ts
08-gc.ts        → 08-gc.ts
09-dirty.ts     → 09-dirty.ts
10-commit.ts    → 10-commit.ts
11-wrap.ts      → 11-wrap.ts
12-splice.ts    → 12-splice.ts
13-named.ts     → 13-named.ts
14-dagql.ts     → 14-pipe.ts
```

**Step 2: Fix imports in each file**

The koans use a re-export chain (each koan re-exports all previous). Switch to direct imports from the earliest defining file. For each file:

- `00-expr.ts` — no imports from other koans (foundation)
- `01-increment.ts` — no imports from other koans (standalone utility)
- `02-build.ts` — imports from `./00-expr` and `./01-increment`
- `03-normalize.ts` — imports from `./00-expr`, `./01-increment`, `./02-build`
- `04-predicates.ts` — imports from `./00-expr`
- `05-select.ts` — imports from `./00-expr`, `./04-predicates`
- `06-map.ts` — imports from `./00-expr`, `./04-predicates`
- `07-replace.ts` — imports from `./00-expr`, `./04-predicates`, `./06-map`
- `08-gc.ts` — imports from `./00-expr`
- `09-dirty.ts` — imports from `./00-expr`
- `10-commit.ts` — imports from `./00-expr`, `./08-gc`, `./09-dirty`
- `11-wrap.ts` — imports from `./00-expr`, `./01-increment`, `./09-dirty`, `./10-commit`
- `12-splice.ts` — imports from `./00-expr`, `./04-predicates`, `./09-dirty`, `./10-commit`
- `13-named.ts` — imports from `./00-expr`, `./01-increment`, `./04-predicates`, `./08-gc`, `./09-dirty`, `./10-commit`
- `14-pipe.ts` — imports from `./00-expr` and whichever operation modules it uses

For each file: identify what symbols it uses from previous koans, trace each to its earliest definition, replace the import. If a symbol is defined in multiple koans, use the **earliest** one and import into the later one.

Add `export` to any types/functions that are used by later koans but not currently exported.

**Step 3: Deduplicate**

If any type or function is defined identically in multiple koan files, keep only the earliest definition. Later files import it. This is the only structural change allowed.

**Step 4: Create barrel file**

Create `packages/core/src/dag/index.ts` that re-exports everything from all 15 files. This is the public API surface for the DAG module.

**Step 5: Verify compilation**
```bash
npx tsc --noEmit
```

All inline type-level tests must pass. Fix any import issues. Zero logic changes — if something doesn't compile, it's an import problem, not a logic problem.

**Step 6: Commit**
```bash
git add packages/core/src/dag/
git commit -m "feat: copy koans 00-14 into core as DAG foundation (#290)"
```

---

### Task 3: Write new fold() — base trampoline

This is the hardest task. Write TDD: tests first, then implementation.

**Files:**
- Create: `packages/core/src/dag/fold.ts`
- Create: `packages/core/tests/dag/fold.test.ts`

**Step 1: Write basic fold test — literal node**

```ts
// packages/core/tests/dag/fold.test.ts
import { describe, it, expect } from "vitest";
import { fold } from "../../src/dag/fold";
import { app, numLit } from "../../src/dag/index";

describe("fold — base trampoline", () => {
  it("evaluates a single literal node", async () => {
    const expr = app(numLit(42));
    // expr is NExpr with a single node of kind "num/lit" with out=42
    // We need to understand the exact NExpr shape to write the interpreter
    const interp = {
      "num/lit": async function* (entry: any) {
        return entry.out; // literal's value is in the out field
      },
    };
    const result = await fold(expr, interp);
    expect(result).toBe(42);
  });
});
```

Note: The exact API of `fold()` and the exact shape of NExpr entries will become clear when reading the koan types in Task 2. Adjust test accordingly. The handler receives the entry from the adjacency map and yields child indices.

**Step 2: Run test — expect FAIL (fold not implemented)**
```bash
npx vitest run packages/core/tests/dag/fold.test.ts
```

**Step 3: Write basic fold test — binary operation with memoization**

```ts
it("evaluates add(numLit(3), numLit(4)) = 7", async () => {
  const expr = app(add(numLit(3), numLit(4)));
  const interp = {
    "num/lit": async function* (entry: any) { return entry.out; },
    "num/add": async function* (_entry: any) {
      const left = (yield 0) as number;
      const right = (yield 1) as number;
      return left + right;
    },
  };
  const result = await fold(expr, interp);
  expect(result).toBe(7);
});

it("memoizes shared DAG nodes", async () => {
  // add(x, x) where x = numLit(5) — x should evaluate once
  let evalCount = 0;
  const x = numLit(5);
  const expr = app(add(x, x));
  const interp = {
    "num/lit": async function* (entry: any) { evalCount++; return entry.out; },
    "num/add": async function* (_entry: any) {
      const left = (yield 0) as number;
      const right = (yield 1) as number;
      return left + right;
    },
  };
  const result = await fold(expr, interp);
  expect(result).toBe(10);
  expect(evalCount).toBe(1); // shared node evaluated once
});
```

**Step 4: Write basic fold test — short-circuit (cond)**

```ts
it("short-circuits: cond does not evaluate untaken branch", async () => {
  // This requires a core/cond node. We'll need to construct it
  // using CExpr builders or adapt the pattern.
  // The handler for core/cond:
  //   yield 0 → predicate
  //   if true: yield 1 (then), skip 2 (else)
  //   if false: yield 2 (else), skip 1 (then)
  let elseEvaluated = false;
  // ... construct DAG with cond node ...
  const interp = {
    "core/cond": async function* (_entry: any) {
      const pred = (yield 0) as boolean;
      return pred ? yield 1 : yield 2;
    },
    // ... literal handlers ...
  };
  // assert elseEvaluated === false
});
```

**Step 5: Write basic fold test — stack safety**

```ts
it("handles 10k+ node chains without stack overflow", async () => {
  // Build a chain: add(add(add(...numLit(1)..., numLit(1)), numLit(1)), numLit(1))
  // 10,000 levels deep. fold() must be stack-safe (trampoline, not recursion).
  let expr = numLit(1);
  for (let i = 0; i < 10_000; i++) {
    expr = add(expr, numLit(0));
  }
  const normalized = app(expr);
  const interp = {
    "num/lit": async function* (entry: any) { return entry.out; },
    "num/add": async function* (_entry: any) {
      return ((yield 0) as number) + ((yield 1) as number);
    },
  };
  const result = await fold(normalized, interp);
  expect(result).toBe(1);
});
```

**Step 6: Implement fold() — base trampoline**

Create `packages/core/src/dag/fold.ts`. Use koan 15's `fold()` as the starting point but write fresh. The algorithm:

```ts
// packages/core/src/dag/fold.ts
//
// Production fold over NExpr adjacency maps.
// Based on koan 15 sketch, adds ST/error/fiber/lambda (in later steps).

export type Handler = (entry: RuntimeEntry) => AsyncGenerator<number, unknown, unknown>;
export type Interpreter = Record<string, Handler>;

interface Frame {
  gen: AsyncGenerator<number, unknown, unknown>;
  entryId: string;
}

export async function fold<O>(
  expr: NExpr<O, any, any, any>,  // adjust generic params as needed
  interp: Interpreter,
): Promise<O> {
  const adj = /* extract adjacency map from expr */;
  const rootId = /* extract root ID from expr */;
  const memo: Record<string, unknown> = {};

  // Explicit frame stack — no recursion
  const stack: Frame[] = [];

  // Start with root
  const rootEntry = adj[rootId];
  const rootHandler = interp[rootEntry.kind];
  stack.push({ gen: rootHandler(rootEntry), entryId: rootId });

  let input: unknown = undefined;

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    const { value, done } = await frame.gen.next(input);

    if (done) {
      // Frame complete — cache result, pop, feed to parent
      memo[frame.entryId] = value;
      stack.pop();
      input = value;
      continue;
    }

    // value is a child index — resolve to child entry ID
    const childIndex = value as number;
    const entry = adj[frame.entryId];
    const childId = entry.children[childIndex]; // adjust to actual shape

    // Check memo
    if (childId in memo) {
      input = memo[childId];
      continue;
    }

    // Push child frame
    const childEntry = adj[childId];
    const childHandler = interp[childEntry.kind];
    stack.push({ gen: childHandler(childEntry), entryId: childId });
    input = undefined;
  }

  return memo[rootId] as O;
}
```

Adjust to match actual NExpr/RuntimeEntry shapes from koan 00. The key: entries in the adjacency map have `kind`, `children` (array of entry IDs), and `out` (output type/value).

**Step 7: Run tests — expect PASS**
```bash
npx vitest run packages/core/tests/dag/fold.test.ts
```

**Step 8: Commit**
```bash
git add packages/core/src/dag/fold.ts packages/core/tests/dag/fold.test.ts
git commit -m "feat: base fold() trampoline over NExpr with memoization (#290)"
```

---

### Task 4: Add ST volatile/taint to fold()

**Files:**
- Modify: `packages/core/src/dag/fold.ts`
- Modify: `packages/core/tests/dag/fold.test.ts`

**Step 1: Write ST tests**

```ts
describe("fold — ST volatile/taint", () => {
  it("volatile nodes (st/get) always re-evaluate", async () => {
    // Build a DAG where st/get appears twice in the tree
    // but shares the same entry. It must evaluate BOTH times
    // (not memoized) because it's volatile.
    // ...
  });

  it("tainted parents skip memo", async () => {
    // If a parent has a volatile child, the parent is tainted
    // and must re-evaluate on subsequent access.
    // ...
  });

  it("taint propagates transitively", async () => {
    // grandparent → parent → volatile child
    // grandparent is also tainted
    // ...
  });
});
```

**Step 2: Run tests — expect FAIL**

**Step 3: Implement volatile/taint in fold()**

Add to fold():
- `VOLATILE_KINDS: Set<string>` — configurable, default includes `"st/get"`, `"core/lambda_param"`
- `tainted: Set<string>` — entry IDs whose subtree contains volatile nodes
- After evaluating a child: if child is volatile or tainted, mark parent as tainted
- Memo check: skip if entry ID is in `tainted` set or kind is in `VOLATILE_KINDS`

**Step 4: Run tests — expect PASS**

**Step 5: Commit**
```bash
git commit -m "feat: ST volatile/taint tracking in fold() (#290)"
```

---

### Task 5: Add error propagation to fold()

**Files:**
- Modify: `packages/core/src/dag/fold.ts`
- Modify: `packages/core/tests/dag/fold.test.ts`

**Step 1: Write error tests**

```ts
describe("fold — error propagation", () => {
  it("error/fail throws and propagates up", async () => {
    // error/fail handler throws an error
    // parent receives the error via gen.throw()
    // ...
  });

  it("error/try catches and evaluates fallback", async () => {
    // error/try wraps child; if child throws, evaluate fallback child
    // ...
  });

  it("uncaught error propagates to fold() caller", async () => {
    // If no error/try catches, fold() itself rejects
    // ...
  });
});
```

**Step 2: Run tests — expect FAIL**

**Step 3: Implement error propagation**

In the trampoline loop:
- When a frame's generator throws (or we need to propagate an error):
  - Pop current frame
  - Call `parentFrame.gen.throw(error)` on the parent
  - If parent catches → continue normally
  - If parent also throws → propagate up
  - If no parent → reject fold()'s promise

The `error/try` handler uses try/catch around its `yield 0` (the child that might fail), and on catch, does `yield 1` (the fallback).

**Step 4: Run tests — expect PASS**

**Step 5: Commit**
```bash
git commit -m "feat: error propagation (try/catch/fail) in fold() (#290)"
```

---

### Task 6: Add fiber parallelism to fold()

**Files:**
- Modify: `packages/core/src/dag/fold.ts`
- Modify: `packages/core/tests/dag/fold.test.ts`

**Step 1: Write fiber tests**

```ts
describe("fold — fiber parallelism", () => {
  it("fiber/spawn runs independent fold() calls", async () => {
    // fiber/par spawns two children that evaluate independently
    // Each gets its own trampoline and memo
    // Results are collected
    // ...
  });

  it("fibers share read-only NExpr safely", async () => {
    // Multiple fibers reading from same adjacency map
    // No interference
    // ...
  });
});
```

**Step 2: Run tests — expect FAIL**

**Step 3: Implement fiber support**

The `fiber/par` (or `fiber/spawn`) handler calls `fold()` recursively for each child. Each inner `fold()` gets:
- Same NExpr (adjacency map is read-only, safe to share)
- Fresh memo and tainted sets
- Same interpreter

The handler awaits all inner fold() calls and combines results.

**Step 4: Run tests — expect PASS**

**Step 5: Commit**
```bash
git commit -m "feat: fiber parallelism in fold() (#290)"
```

---

### Task 7: Add scoped lambdas to fold()

**Files:**
- Modify: `packages/core/src/dag/fold.ts`
- Modify: `packages/core/tests/dag/fold.test.ts`

**Step 1: Write lambda tests**

```ts
describe("fold — scoped lambdas", () => {
  it("lambda_param resolves from scope stack", async () => {
    // A lambda body containing lambda_param nodes
    // When invoked, params resolve from scope bindings
    // ...
  });

  it("nested lambda scopes shadow correctly", async () => {
    // Inner lambda shadows outer lambda's param
    // ...
  });

  it("lambda_param is volatile (taint-propagated)", async () => {
    // Multiple invocations with different args re-evaluate
    // ...
  });
});
```

**Step 2: Run tests — expect FAIL**

**Step 3: Implement scoped lambdas**

Changes to fold():
- Yield type becomes `number | { child: number, scope: Record<string, unknown> }`
- `scopeStack: Array<Record<string, unknown>>` in trampoline state
- When a handler yields `{ child, scope }`:
  - Push scope onto scopeStack
  - Evaluate child
  - Pop scope after child completes
- `core/lambda_param` handler reads from `scopeStack[scopeStack.length - 1]`
- `core/lambda_param` is in VOLATILE_KINDS (always re-evaluates)
- Taint propagation ensures parents of lambda_param re-evaluate when invoked with different args

**Step 4: Run tests — expect PASS**

**Step 5: Commit**
```bash
git commit -m "feat: scoped lambda support in fold() (#290)"
```

---

### Task 8: Gut builder — rewrite mvfm()

**Files:**
- Modify: `packages/core/src/builder.ts` (heavy rewrite)
- Modify: `packages/core/src/types.ts` (delete Expr, slim PluginContext)
- Delete: `packages/core/src/proxy.ts`
- Modify: `packages/core/tests/core-behavior.test.ts` (rewrite)

**Step 1: Write new builder tests**

```ts
// packages/core/tests/builder.test.ts
import { describe, it, expect } from "vitest";
import { mvfm } from "../src/builder";
// import test plugins...

describe("mvfm() — DAG builder", () => {
  it("produces NExpr from user closure", () => {
    const app = mvfm(/* plugins */);
    const program = app(($) => {
      return $.num.add($.num.lit(3), $.num.lit(4));
    });
    // program.ast is an NExpr
    // program.ast has a root node of kind "num/add"
    // ...verify adjacency map structure...
  });

  it("content-addressed: equal subtrees share IDs", () => {
    const app = mvfm(/* plugins */);
    const program = app(($) => {
      const x = $.num.lit(5);
      return $.num.add(x, x);
    });
    // In the NExpr adjacency map, the literal node appears once
    // The add node's children both point to the same ID
    // ...
  });
});
```

**Step 2: Run tests — expect FAIL**

**Step 3: Delete proxy.ts**

Remove the entire file. It contains: `isExpr`, `autoLift`, `makeExprProxy`, `MVFM` symbol usage.

**Step 4: Gut types.ts**

Delete from `types.ts`:
- `MVFM` symbol
- `ExprBase<T>`
- `ExprFields<T>`
- `Expr<T>`

Slim `PluginContext` to:
```ts
export interface PluginContext {
  plugins: PluginDefinition[];
}
```

Change `CoreDollar` to return CExprs instead of Exprs. The exact shape depends on how koan CExpr builders integrate — this is where the rubber meets the road.

`Program<K>` changes:
```ts
export interface Program<K extends string = string> {
  ast: NExpr<any, any, any, any>;  // was: ast: any (nested tree)
  hash: string;
  plugins: string[];
  inputSchema: Record<string, unknown>;
  readonly __kinds?: K;
}
```

**Step 5: Rewrite builder.ts**

The new `mvfm()`:
1. Resolve plugins (same as before)
2. Create thin `PluginContext` (just `{ plugins }`)
3. Call each `plugin.build(ctx)` — they now return CExpr builder functions
4. Compose `$` = core CExpr builders + plugin contributions
5. Run user closure, get back a CExpr
6. Call `app()` (from `packages/core/src/dag/03-normalize`) to normalize to NExpr
7. Return `Program<K>` with NExpr, hash, plugin names

Core dollar methods become CExpr builders:
- `$.cond(pred, then, else)` → constructs CExpr with kind `"core/cond"` and 3 children
- `$.begin(a, b, c)` → desugars to chain of `core/discard` CExprs
- `$.rec(fn)` → constructs CExpr with kind `"core/rec"`
- `$.input` → CExpr with kind `"core/input"`

The `core/discard` pattern:
```ts
begin(first, ...rest) {
  // begin(a, b, c) → discard(a, discard(b, c))
  // discard evaluates child 0 (side effect), returns child 1
  return [first, ...rest].reduceRight((acc, expr) =>
    makeCExpr("core/discard", [expr, acc])
  );
}
```

**Step 6: Run tests — expect PASS**

**Step 7: Commit**
```bash
git commit -m "feat: rewrite mvfm() to produce NExpr via content-addressed construction (#290)"
```

---

### Task 9: Rewrite core interpreters

**Files:**
- Rewrite: `packages/core/src/interpreters/core.ts`
- Modify: `packages/core/tests/interpreters/core.test.ts`

**Step 1: Write core interpreter tests with new API**

Tests for each core handler with positional children:
- `core/literal` — returns entry's out value, no children
- `core/cond` — yield 0 (pred), conditionally yield 1 or 2 (short-circuit)
- `core/discard` — yield 0 (ignore result), yield 1 (return)
- `core/input` — returns injected input data
- `core/prop_access` — yield 0, access property on result
- `core/record` — yield all children, assemble object
- `core/tuple` — yield all children, assemble array
- `core/rec` — recursive evaluation (scoped yield)
- `core/lambda` / `core/lambda_param` — scoped lambda mechanism

**Step 2: Run tests — expect FAIL**

**Step 3: Implement new core interpreter**

```ts
// packages/core/src/interpreters/core.ts
import type { Handler, Interpreter } from "../dag/fold";

export const coreInterpreter: Interpreter = {
  "core/literal": async function* (entry) {
    return entry.out;
  },

  "core/cond": async function* (_entry) {
    const pred = (yield 0) as boolean;
    return pred ? yield 1 : yield 2;
  },

  "core/discard": async function* (_entry) {
    yield 0; // evaluate for side effect, discard result
    return yield 1; // evaluate and return
  },

  "core/input": async function* (entry) {
    return entry.__inputData; // injected by injectInput
  },

  "core/prop_access": async function* (entry) {
    const obj = (yield 0) as Record<string, unknown>;
    return obj[entry.property]; // property name stored in entry metadata
  },

  "core/record": async function* (entry) {
    const result: Record<string, unknown> = {};
    for (let i = 0; i < entry.children.length; i++) {
      result[entry.fieldNames[i]] = yield i;
    }
    return result;
  },

  "core/tuple": async function* (entry) {
    const result: unknown[] = [];
    for (let i = 0; i < entry.children.length; i++) {
      result.push(yield i);
    }
    return result;
  },

  // core/rec, core/lambda, core/lambda_param use scoped yields
  // Exact implementation depends on fold() scoped lambda support from Task 7
};
```

Note: Some handlers need metadata beyond positional children (e.g., `core/prop_access` needs the property name, `core/record` needs field names). This metadata lives in the entry's `out` field or a separate metadata field. **If the koan NExpr entry shape can't carry this metadata → HALT and report.**

**Step 4: Run tests — expect PASS**

**Step 5: Commit**
```bash
git commit -m "feat: rewrite core interpreters as positional handlers (#290)"
```

---

### Task 10: Rewrite plugin build() methods

**Files:**
- Modify: ALL files in `packages/core/src/plugins/*/index.ts`

Each plugin's `build(ctx)` must be rewritten to return functions that produce CExprs instead of Exprs. This is mechanical:

**Before (num plugin):**
```ts
build(ctx: PluginContext): NumMethods {
  const binop = (kind: string) => (a, b) =>
    ctx.expr<number>({ kind, left: ctx.lift(a).__node, right: ctx.lift(b).__node });
  return { sub: binop("num/sub"), ... };
}
```

**After (num plugin):**
```ts
build(ctx: PluginContext): NumMethods {
  const binop = (kind: string) => (a: CExpr, b: CExpr) =>
    makeCExpr(kind, [a, b]); // content-addressed construction
  return { sub: binop("num/sub"), ... };
}
```

The exact CExpr builder API depends on how we generalize koan 02's `numLit`, `add`, `mul` pattern to arbitrary node kinds. Koan 02 only has 3 specific builders. We need a generic `makeCExpr(kind, children, out?)` that:
1. Generates a content-addressed ID from kind + children IDs
2. Merges adjacency maps from all children
3. Returns a new CExpr

**If the koan type system can't support a generic CExpr builder (because CExpr IDs are structurally encoded per kind) → this is a potential HALT point.** The type-level content addressing in koan 02 generates IDs like `L3`, `A(L3,L4)` where the prefix is kind-specific. A generic builder might need a different ID scheme. Investigate before implementing.

**Step 1: Assess whether generic CExpr builder is possible**

Read koan 02 types carefully. If `CExprHash` can be generalized to arbitrary kinds (not just `L`, `A`, `M`), proceed. If not, each plugin would need its own CExpr builder type — investigate whether this scales.

**Step 2: Implement generic builder or per-plugin builders**

**Step 3: Rewrite each plugin's build() method**

**Step 4: Run build to verify compilation**
```bash
npm run build
```

**Step 5: Commit**
```bash
git commit -m "feat: rewrite plugin build() methods for CExpr construction (#290)"
```

---

### Task 11: Rewrite plugin interpreters

**Files:**
- Modify: ALL files in `packages/core/src/plugins/*/interpreter.ts`

Mechanical transform: named field access → positional children.

For each plugin interpreter file, apply this pattern:

**Binary ops** (num/add, num/sub, str/concat, bool/and, etc.):
```ts
// Before:
"num/sub": async function* (node: NumSubNode) {
  return (yield* eval_(node.left)) - (yield* eval_(node.right));
}
// After:
"num/sub": async function* (_entry) {
  return ((yield 0) as number) - ((yield 1) as number);
}
```

**Unary ops** (num/neg, str/upper, etc.):
```ts
// Before:
"num/neg": async function* (node: NumNegNode) {
  return -(yield* eval_(node.operand));
}
// After:
"num/neg": async function* (_entry) {
  return -((yield 0) as number);
}
```

**Variadic ops** (num/min, str/template, etc.):
```ts
// Before:
"num/min": async function* (node: NumMinNode) {
  const values = [];
  for (const child of node.values) values.push(yield* eval_(child));
  return Math.min(...values);
}
// After:
"num/min": async function* (entry) {
  const values: number[] = [];
  for (let i = 0; i < entry.children.length; i++) {
    values.push((yield i) as number);
  }
  return Math.min(...values);
}
```

**Effect plugins** (st, error, fiber, control) need more care:
- `st/let`, `st/get`, `st/set` — use mutable store from closure, same pattern but positional
- `error/try` — uses try/catch around `yield 0`, fallback is `yield 1`
- `fiber/par` — calls fold() recursively per child
- `control/each`, `control/while` — loop patterns with scoped yields

**Step 1: Rewrite each interpreter file**

**Step 2: Run tests**
```bash
npm run test
```

**Step 3: Commit**
```bash
git commit -m "feat: rewrite plugin interpreters as positional handlers (#290)"
```

Note: The issue says plugin interpreter rewrites are #291. However, since core includes all built-in plugins and we need to verify the pattern works end-to-end, we do this here. #291 is for external plugins in `packages/plugin-*/`.

---

### Task 12: Rewrite tests

**Files:**
- Modify/rewrite: ALL test files in `packages/core/tests/`
- Delete: tests for removed machinery

**Step 1: Delete tests for removed machinery**

These test files test Proxy/Expr/reachability that no longer exists:
- Parts of `core-behavior.test.ts` testing auto-lifting, proxy property access, reachability analysis
- Parts of `core-metadata.test.ts` testing content hashing via JSON.stringify of nested AST
- `inject.test.ts` — injectInput may change shape significantly

**Step 2: Rewrite semantic tests**

For each surviving test, rewrite to use new API:
- Construct programs using `mvfm()` with CExpr builders
- Execute using `fold()` with composed interpreter from `defaults()`
- Assert same semantic results

Key semantics to preserve:
- `cond` short-circuits (untaken branch not evaluated)
- `begin`/`discard` sequences side effects
- `rec` handles recursion (Y combinator pattern)
- Shared subtrees evaluate once (memoization)
- `st/get` always re-evaluates (volatile)
- `error/try` catches `error/fail`
- `fiber/par` runs children concurrently
- Lambda params resolve from scope
- Plugin operations compute correct results

**Step 3: Run full test suite**
```bash
npm run test
```

**Step 4: Commit**
```bash
git commit -m "feat: rewrite tests for DAG model (#290)"
```

---

### Task 13: Delete dead code — final sweep

**Files:**
- Delete: `packages/core/src/proxy.ts` (if not already deleted in Task 8)
- Gut: `packages/core/src/utils.ts` — remove `nextNodeId`, `simpleHash`, `isInternalNode`
- Gut: `packages/core/src/types.ts` — remove all Expr-related types
- Modify: `packages/core/src/index.ts` — update exports
- Delete: any orphaned type definitions, interfaces, helper functions

**Step 1: Search for dead imports**
```bash
npx tsc --noEmit 2>&1 | grep "is declared but"
```

**Step 2: Remove all dead code**

**Step 3: Update index.ts exports**

New public API surface:
- `fold` (was `foldAST`)
- `mvfm` (same name, new internals)
- `defaults` (same name, new handler types)
- `coreInterpreter` (same name, new handlers)
- All DAG primitives from `packages/core/src/dag/index.ts`
- All plugin definitions and interpreters
- Remove: `eval_`, `recurseScoped`, `TypedNode`, `Expr`, `createFoldState`, `VOLATILE_KINDS` (if internalized)

**Step 4: Run full validation**
```bash
npm run build && npm run check && npm test
```

**Step 5: Commit**
```bash
git commit -m "chore: delete dead code from pre-DAG era (#290)"
```

---

### Task 14: Final verification

**Step 1: Run full build + check + test**
```bash
npm run build && npm run check && npm test
```

**Step 2: Verify acceptance criteria**

Check each item from the issue:
- [ ] Koans 00-14 in core with zero logic changes
- [ ] All existing test semantics preserved
- [ ] No `any` types or `as` casts in production code
- [ ] Build + check + test clean
- [ ] ST volatile/taint works
- [ ] Error propagation works
- [ ] Fiber parallelism works
- [ ] Scoped lambdas work
- [ ] Short-circuit evaluation works
- [ ] Stack safety (10k+ nodes)
- [ ] Memoization (shared DAG nodes evaluate once)
- [ ] Content-addressed construction (structural sharing)

**Step 3: Create PR**
```bash
gh pr create --title "feat: port DAG model to core, replace foldAST with fold (#290)" --body "$(cat <<'EOF'
## Summary

Closes #290

Replaces core's nested TypedNode tree model with the koan-proven DAG adjacency map model:
- Koans 00-14 imported verbatim as immutable foundation in `packages/core/src/dag/`
- `foldAST` rewritten as `fold()` over NExpr adjacency maps
- ST volatile/taint, error propagation, fiber parallelism, scoped lambdas all supported
- Builder produces CExprs via content-addressed construction, normalizes via `app()`
- Entire Proxy/Expr<T> system deleted

## Design alignment

- Follows design doc: `docs/plans/2026-02-19-issue-290-dag-model-port-design.md`
- Koans are the trunk; core adapts to them
- No koan modifications

## Validation performed

- `npm run build && npm run check && npm test` clean
- All acceptance criteria verified
- Stack safety tested with 10k+ node chains
- Memoization verified: shared DAG nodes evaluate once
- Short-circuit verified: untaken cond branches not evaluated

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**Step 4: Wait for CI**
```bash
gh pr checks <N> --watch
```
