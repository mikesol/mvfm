# The Story

You have a program — say, `(3 + 4) * 5`. Today you build it with `mvfm` and hand it to `foldAST`, which evaluates it to `35`. That's great, but there's no way to **inspect or transform** the program between construction and evaluation. You can't ask "which nodes are additions?", you can't swap `add` for `mul`, you can't wrap every IO node in a telemetry span. The AST is an opaque tree that goes in one end and a result comes out the other.

The koans build a typed DAG layer that sits in that gap.

---

## Koan 00–01: What is an expression, really?

An expression is a phantom-branded wrapper around an adjacency map. At runtime it's just an ID and a bag of nodes. At the type level, TypeScript knows the exact shape of every node.

```ts
// A single node: kind, children IDs, and output type
type NodeEntry<Kind, ChildIDs, Out> = {
  readonly kind: Kind; readonly children: ChildIDs; readonly out: Out;
};
```

There are two expression types, reflecting two phases of life:

- **`CExpr<O, Id, Adj>`** — construction-time, with content-addressed IDs (ephemeral)
- **`NExpr<O, RootId, Adj, Ctr>`** — normalized, with sequential IDs (what everything downstream sees)

IDs are base-26 strings (`"a"`, `"b"`, ..., `"z"`, `"aa"`, `"ab"`, ...). `Increment<"z">` is `"aa"`. The type-level computation mirrors the runtime function exactly.

## Koan 02: Building programs (content-addressed)

Construction uses **content-addressed IDs** — each node's ID is derived from its structure. No counter threading, no collision risk:

```ts
const three = numLit(3);   // CExpr: ID = "L3", adj = { L3: NodeEntry<"num/literal", [], number> }
const four = numLit(4);    // CExpr: ID = "L4", adj = { L4: NodeEntry<"num/literal", [], number> }
const sum = add(three, four);
// CExpr: ID = "A(L3,L4)", adj = { L3: ..., L4: ..., "A(L3,L4)": NodeEntry<"num/add", ["L3","L4"], number> }
```

Adjacency maps merge via intersection: `CAdjOf<L> & CAdjOf<R> & Record<newId, ...>`. DAG sharing is free — `add(numLit(3), numLit(3))` produces two references to one `"L3"` entry, not two separate nodes.

The content-addressed IDs look ugly (`"M(A(L3,L4),L5)"`), but they're ephemeral. Nobody ever sees them.

## Koan 03: Traits — typeclass-style polymorphism

Before we enter the DAG world, we prove that **multiple types can share a single polymorphic interface** — the Haskell typeclass pattern, adapted for CExpr.

A `TraitInstance<ForType, Kind>` links a phantom type to a node kind: "for type `number`, eq produces `num/eq` nodes." Plugins bundle constructors with their trait instances:

```ts
const numPlugin = {
  ctors: { numLit, add, mul },
  instances: [{ _forType: number, kind: "num/eq", forTypeTag: "number", ctor: numEq }],
};
```

`composeEq(instances)` builds a polymorphic `eq` function. At the type level, `NoInfer<O>` on the right argument prevents TypeScript from widening to a union — so `eq(numLit(3), strLit("b"))` is a compile error, not a runtime surprise. `ResolveKind<O, Instances>` selects the correct node kind:

```ts
const eq = composeEq([numEqInstance, strEqInstance]);
eq(numLit(3), numLit(4));   // ✓ → CExpr<boolean> with kind "num/eq"
eq(strLit("a"), strLit("b")); // ✓ → CExpr<boolean> with kind "str/eq"
eq(numLit(3), strLit("b")); // ✗ compile error: number ≠ string
```

`mvfm(...plugins)` composes plugins into a `$` record: all constructors spread in, plus trait dispatchers typed as the intersection of all registered instances. If you load `numPlugin` but not `strPlugin`, `$.eq` rejects string arguments at the type level.

At runtime, dispatch matches the left argument's output type tag to find the correct instance.

## Koan 04: The app boundary (normalization)

`app` is where construction ends and the real world begins. It performs a **type-level post-order DFS** that replaces content-addressed IDs with clean sequential ones:

```ts
const cexpr = mul(add(numLit(3), numLit(4)), numLit(5));
const prog = app(cexpr);
// NExpr with:
//   rootId: "e"
//   adj: {
//     a: NodeEntry<"num/literal", [], number>     // was L3
//     b: NodeEntry<"num/literal", [], number>     // was L4
//     c: NodeEntry<"num/add", ["a","b"], number>  // was A(L3,L4)
//     d: NodeEntry<"num/literal", [], number>     // was L5
//     e: NodeEntry<"num/mul", ["c","d"], number>  // was M(A(L3,L4),L5)
//   }
//   counter: "f"
```

The normalizer tracks visited nodes so DAG sharing is preserved — if the same subtree appears twice, it gets one ID, not two. The `counter` field tells you the next available ID for operations that need to mint new nodes (like `wrap`).

Everything downstream — predicates, transforms, GC, the fluent API — operates on `NExpr` with its clean, flat adjacency map.

## Koan 05–06: Asking questions about the graph

Predicates are objects that work at both levels — runtime (boolean filter) and type level (computed key set):

```ts
const adds = selectWhere(prog, byKind("num/add"));
// Runtime: Set {"c"}
// Type: Set<"c">

const leaves = selectWhere(prog, isLeaf());
// Runtime: Set {"a", "b", "d"}

const binaryNums = selectWhere(prog, and(byKindGlob("num/"), hasChildCount(2)));
// Runtime: Set {"c", "e"}
```

The type system tracks which keys matched. You can assign `"c"` to an `AddKeys` variable but not `"a"` — that's a compile error.

## Koan 07–08: Transforming nodes

`mapWhere` applies a function to every matching node. The result type updates precisely:

```ts
const swapped = mapWhere(prog, byKind("num/add"), (entry) => ({
  kind: "num/sub" as const,
  children: entry.children,
  out: entry.out,
}));

// Type-level: swapped's adj["c"]["kind"] is "num/sub", not "num/add"
// Type-level: adj["a"]["kind"] is still "num/literal" (unmatched, preserved)
```

If you map the root node, the output type changes too:

```ts
const stringified = mapWhere(prog, byKind("num/mul"), (_e) => ({
  kind: "str/repr" as const,
  children: ["c", "d"] as ["c", "d"],
  out: "" as string,
}));
// Output type is now string, not number
```

`replaceWhere` is shorthand for when you only want to change the kind:

```ts
const replaced = replaceWhere(prog, byKind("num/add"), "num/sub");
```

## Koan 09: Garbage collection

After mutations, orphan nodes may exist — nodes reachable from nothing. `CollectReachable` finds what's alive by walking forward from the root:

```ts
type CollectReachable<Adj, Queue, Visited> =
  Queue extends [Head, ...Rest]
    ? Head extends Visited ? CollectReachable<Adj, Rest, Visited>       // skip
    : Adj[Head] extends NodeEntry<any, Children, any>
      ? CollectReachable<Adj, [...Children, ...Rest], Visited | Head>   // enqueue children
      : CollectReachable<Adj, Rest, Visited | Head>
    : Visited;

type LiveAdj<Adj, RootID> = {
  [K in keyof Adj as K extends CollectReachable<Adj, [RootID]> ? K : never]: Adj[K];
};
```

This is a queue-based DFS that accumulates reachable IDs into a union. Each node is visited exactly once. The mapped type (`LiveAdj`) runs once at the end to filter — no nested mapped types per iteration.

```ts
const d = dirty(prog);
const d2 = addEntry(d, "orphan", { kind: "dead", children: [], out: undefined });
const d3 = gc(d2);
const clean = commit(d3);

// Runtime: "orphan" is gone
// Type-level: clean's adj has no "orphan" key — accessing it is a compile error
```

Stress-tested to ~900 chain nodes and ~8000 tree nodes before hitting TS recursion limits. Realistic programs are well within these bounds.

## Koan 10–11: The sharp knives

Sometimes you need to do surgery — add a node, remove one, rewire children. These operations are unsafe (you could create dangling references), so they produce a `DirtyExpr` that **cannot** be used where an `NExpr` is expected:

```ts
const d = dirty(prog);                    // NExpr → DirtyExpr
const d2 = addEntry(d, "f", { kind: "debug/log", children: ["e"], out: undefined });
const d3 = removeEntry(d2, "a");          // now "c" has a dangling child
const d4 = rewireChildren(d3, "a", "b");  // fix: "c" now points to ["b","b"]
const d5 = setRoot(d4, "f");              // root is now the debug node

// This is a compile error — DirtyExpr is not NExpr:
foldAST(interp, d5); // ✗

// commit validates at runtime, then returns a clean NExpr:
const clean = commit(d5); // ✓ — root exists, all children exist
```

`commit` throws if the graph is broken (missing root, dangling children). It's the airlock between "I'm doing surgery" and "this is safe to use."

## Koan 12: Wrapping nodes

You want to insert a telemetry span around every fetch call, or a debug wrapper around a specific node:

```ts
const wrapped = wrapByName(prog, "c", "telemetry/span");
// Before: e(mul) → c(add), d(lit5)
// After:  e(mul) → f(telemetry/span) → c(add), d(lit5)
```

The wrapper gets the next counter ID (`"f"`). All parents of `"c"` are rewired to point to `"f"` instead. The type reflects this precisely — `adj["e"]["children"]` is `["f", "d"]`, not `["c", "d"]`.

Wrapping the root changes the root ID:

```ts
const wrappedRoot = wrapByName(prog, "e", "debug/root");
// wrappedRoot.__id === "f", wrappedRoot.__adj["f"].children === ["e"]
```

## Koan 13: Splicing nodes out

The inverse of wrapping — remove a node and reconnect:

```ts
// Wrap then splice: should round-trip
const roundTripped = spliceWhere(
  wrapByName(prog, "c", "debug/wrap"),
  byKind("debug/wrap"),
);
// "debug/wrap" removed, "e" points directly to "c" again

// Splice leaves: detach from parents
const noLiterals = spliceWhere(prog, byKind("num/literal"));
// add node now has empty children
```

Previous spikes returned `Expr<any, any>` here — full type erasure. This koan's job is to do better. At minimum, the surviving nodes' types should be preserved.

## Koan 14: Named nodes

Sometimes you want to refer to a node by name rather than by ID:

```ts
const named = name(prog, "the-sum", "c");

// Now you can query by name:
const matches = selectWhere(named, byName("the-sum"));
// matches: Set {"c"}

// And transform by name:
const replaced = replaceWhere(named, byName("the-sum"), "num/sub");
```

Aliases are `@name` entries in the adj that point to the target ID. The tricky part: gc must not kill them (they're not in any node's `children` array, so forward-reachability misses them).

## Koan 15: Fluent chaining

For multi-step transforms, a fluent API reads better:

```ts
const result = dagql(prog)
  .replaceWhere(byKind("num/add"), "num/sub")
  .spliceWhere(isLeaf())
  .result();
```

## Koan 16: The bridge — fold, traits, and the full pipeline

Everything connects back. `fold()` is a trampoline-based async stack machine that drives generator handlers over the DAG adjacency map. Each handler yields child indices and receives evaluated results:

```ts
const interp: Interpreter = {
  "num/literal": async function* (entry) { return entry.out as number; },
  "num/add": async function* () {
    const l = (yield 0) as number;
    const r = (yield 1) as number;
    return l + r;
  },
};
```

The full pipeline ties everything together — `mvfm` composes plugins with trait dispatch, builds a CExpr, normalizes to NExpr, transforms with dagql, and folds to a result:

```ts
const $ = mvfm(fpNumPlugin, fpStrPlugin, fpBoolPlugin);

// Trait dispatch: eq specializes to num/eq at the call site
const eqExpr = $.eq($.numLit(3), $.numLit(3));  // CExpr<boolean>, kind = "num/eq"
const prog = app(eqExpr);                        // NExpr

// dagql transform: rewrite num/eq → num/add
const transformed = pipe(prog, (e) => replaceWhere(e, byKind("num/eq"), "num/add"));

// fold: evaluate the rewritten program
const result = await fold(transformed.__id, transformed.__adj, interp);
// 3 + 3 = 6 (eq was rewritten to add)
```

---

## API Cheat Sheet

### Types

| Type | Purpose |
|---|---|
| `NodeEntry<Kind, ChildIDs, Out>` | One node in the adjacency map |
| `CExpr<O, Id, Adj>` | Construction-time expression (content-addressed IDs) |
| `NExpr<O, RootId, Adj, Ctr>` | Normalized expression (sequential IDs) |
| `DirtyExpr<O, R>` | Mutable, uncommitted expression |
| `RuntimeEntry` | Untyped runtime node |
| `NameAlias<Name, TargetID, Out>` | Named reference to a node |
| `TraitInstance<ForType, Kind>` | Links a type to its trait node kind |
| `PluginShape<Ctors, Instances>` | Plugin: constructors + trait instances |
| `ComposedEq<Instances>` | Polymorphic eq built from instances |

### Extractors

| Type | Extracts |
|---|---|
| `CIdOf<E>` | Content-addressed ID from CExpr |
| `CAdjOf<E>` | Content-addressed adj from CExpr |
| `IdOf<E>` | Root ID from NExpr |
| `AdjOf<E>` | Adjacency map from NExpr |
| `CtrOf<E>` | Counter from NExpr |

### Construction (CExpr, content-addressed)

| Function | Produces |
|---|---|
| `numLit(n)` | `CExpr<number, "L{n}", ...>` |
| `strLit(s)` | `CExpr<string, "S{s}", ...>` |
| `boolLit(b)` | `CExpr<boolean, "B{b}", ...>` |
| `add(a, b)` | `CExpr<number, "A({aId},{bId})", ...>` |
| `mul(a, b)` | `CExpr<number, "M({aId},{bId})", ...>` |

### Trait Composition

| Function | Does |
|---|---|
| `composeEq(instances)` | Builds polymorphic eq from trait instances |
| `mvfm(...plugins)` | Composes plugins into `$` with constructors + trait dispatchers |

### Normalization

| Function | Does |
|---|---|
| `app(cexpr)` | `CExpr → NExpr` via type-level DFS |

### Predicates

| Constructor | Matches |
|---|---|
| `byKind("num/add")` | Exact kind |
| `byKindGlob("num/")` | Kind prefix |
| `isLeaf()` | 0 children |
| `hasChildCount(2)` | Exact child count |
| `not(p)` | Negation |
| `and(a, b)` | Both match |
| `or(a, b)` | Either matches |
| `byName("x")` | Node targeted by `@x` alias |

### Query & Transform (NExpr → NExpr)

| Function | Does |
|---|---|
| `selectWhere(expr, pred)` | `→ Set<matched IDs>` |
| `mapWhere(expr, pred, fn)` | Transform matched nodes |
| `replaceWhere(expr, pred, kind)` | Change kind of matched nodes |
| `wrapByName(expr, id, kind)` | Insert wrapper above target |
| `spliceWhere(expr, pred)` | Remove matched nodes, reconnect |

### Sharp Knives (NExpr → DirtyExpr → NExpr)

| Function | Does |
|---|---|
| `dirty(expr)` | `NExpr → DirtyExpr` |
| `addEntry(d, id, entry)` | Add node |
| `removeEntry(d, id)` | Remove node |
| `swapEntry(d, id, entry)` | Replace node |
| `rewireChildren(d, old, new)` | Rewrite child references |
| `setRoot(d, id)` | Change root |
| `gc(d)` | Remove unreachable nodes (CollectReachable) |
| `commit(d)` | Validate → `NExpr` |

### GC Internals

| Type | Does |
|---|---|
| `CollectReachable<Adj, Queue, Visited>` | Queue-based forward DFS, returns reachable union |
| `LiveAdj<Adj, RootID>` | Filters adj to reachable nodes only |

### Fluent

```ts
dagql(expr).mapWhere(...).replaceWhere(...).spliceWhere(...).result()
```

### Fold & Interpreters

| Function | Does |
|---|---|
| `fold(rootId, adj, interp)` | Async trampoline fold over DAG |
| `defaults(plugins)` | Merge plugin interpreters |
