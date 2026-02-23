import type { NodeExample } from "./types";

const examples: Record<string, NodeExample> = {
  "dagql/pipe": {
    description:
      "Functional chaining — compose multiple DAG transformations in a single expression.",
    code: `// 1. make an app
const app = mvfm(prelude, console_);

// 2. make a program: (x + 10) * 2
const prog = app({ x: "number" }, ($) =>
  $.begin(
    $.console.log("result:", $.mul($.add($.input.x, 10), 2)),
    $.mul($.add($.input.x, 10), 2)
  )
);

const injected = injectInput(prog, { x: 5 });

// 3. dagql: chain two rewrites with pipe
const rewritten = commit(
  pipe(
    injected.__nexpr,
    (e) => replaceWhere(e, byKind("num/add"), "num/sub"),
    (e) => replaceWhere(e, byKind("num/mul"), "num/add"),
  )
);

// 4. fold: was (5+10)*2=30, now (5-10)+2=-3
await fold(rewritten, defaults(app));`,
  },

  "dagql/dirty": {
    description:
      "Convert an immutable NExpr into a mutable DirtyExpr for low-level editing.",
    code: `// 1. make an app
const app = mvfm(prelude, console_);

// 2. make a program: x + 10
const prog = app({ x: "number" }, ($) =>
  $.begin($.console.log("result:", $.add($.input.x, 10)), $.add($.input.x, 10))
);

const injected = injectInput(prog, { x: 5 });

// 3. dagql: dirty opens the NExpr for mutation
const d = dirty(injected.__nexpr);

// swapEntry replaces a single node by ID
const ids = selectWhere(injected.__nexpr, byKind("num/add"));
const addId = [...ids][0];
const entry = d.__adj[addId];
const swapped = swapEntry(d, addId, {
  ...entry,
  kind: "num/sub",
});

// commit seals it back to an immutable NExpr
const result = commit(swapped);

// 4. fold: was 5+10=15, now 5-10=-5
await fold(result, defaults(app));`,
  },

  "dagql/commit": {
    description:
      "Validate and seal a DirtyExpr back into an immutable NExpr for folding.",
    code: `// 1. make an app
const app = mvfm(prelude, console_);

// 2. make a program: x * 3
const prog = app({ x: "number" }, ($) =>
  $.begin($.console.log("result:", $.mul($.input.x, 3)), $.mul($.input.x, 3))
);

const injected = injectInput(prog, { x: 7 });

// 3. dagql: replaceWhere returns a DirtyExpr
const dirtyResult = replaceWhere(
  injected.__nexpr,
  byKind("num/mul"),
  "num/add"
);

// commit validates all child refs exist, then seals
const sealed = commit(dirtyResult);

// 4. fold: was 7*3=21, now 7+3=10
await fold(sealed, defaults(app));`,
  },

  "dagql/selectWhere": {
    description:
      "Query the AST — find node IDs matching a predicate (byKind, isLeaf, etc.).",
    code: `// 1. make an app
const app = mvfm(prelude, console_);

// 2. make a program: (x + 10) * (x - 3)
const prog = app({ x: "number" }, ($) =>
  $.mul($.add($.input.x, 10), $.sub($.input.x, 3))
);

const injected = injectInput(prog, { x: 5 });

// 3. dagql: query the AST with different predicates
const adds = selectWhere(injected.__nexpr, byKind("num/add"));
const leaves = selectWhere(injected.__nexpr, isLeaf());
const binary = selectWhere(injected.__nexpr, hasChildCount(2));
const allNum = selectWhere(injected.__nexpr, byKindGlob("num/"));

console.log("add nodes:", adds.size);
console.log("leaf nodes:", leaves.size);
console.log("binary ops:", binary.size);
console.log("all num nodes:", allNum.size);

// 4. fold the original
await fold(defaults(app), injected);`,
  },

  "dagql/replaceWhere": {
    description:
      "Swap the kind of matching nodes while preserving their children and output type.",
    code: `// 1. make an app
const app = mvfm(prelude, console_);

// 2. make a program: (x + 10) * 2
const prog = app({ x: "number" }, ($) =>
  $.begin(
    $.console.log("before:", $.mul($.add($.input.x, 10), 2)),
    $.mul($.add($.input.x, 10), 2)
  )
);

const injected = injectInput(prog, { x: 5 });

// 3. dagql: replace all add nodes with sub
const rewritten = commit(
  replaceWhere(injected.__nexpr, byKind("num/add"), "num/sub")
);

// 4. fold: was (5+10)*2=30, now (5-10)*2=-10
await fold(rewritten, defaults(app));`,
  },

  "dagql/mapWhere": {
    description:
      "Transform matching nodes via callback — change kind, children, or metadata.",
    code: `// 1. make an app
const app = mvfm(prelude, console_);

// 2. make a program: (x + 10) * 2
const prog = app({ x: "number" }, ($) =>
  $.begin(
    $.console.log("result:", $.mul($.add($.input.x, 10), 2)),
    $.mul($.add($.input.x, 10), 2)
  )
);

const injected = injectInput(prog, { x: 5 });

// 3. dagql: mapWhere gives you the full entry to transform
const rewritten = commit(
  mapWhere(injected.__nexpr, byKind("num/add"), (entry) => ({
    kind: "num/sub",
    children: entry.children,
    out: entry.out,
  }))
);

// 4. fold: was (5+10)*2=30, now (5-10)*2=-10
await fold(rewritten, defaults(app));`,
  },

  "dagql/spliceWhere": {
    description:
      "Remove matched nodes from the graph, reconnecting their first child to their parents.",
    code: `// 1. make an app
const app = mvfm(prelude, console_);

// 2. make a program: (x + 10) * 2
const prog = app({ x: "number" }, ($) =>
  $.begin(
    $.console.log("result:", $.mul($.add($.input.x, 10), 2)),
    $.mul($.add($.input.x, 10), 2)
  )
);

const injected = injectInput(prog, { x: 5 });

// 3. dagql: splice out the mul node — its first child (add) becomes the root expression
const spliced = spliceWhere(injected.__nexpr, byKind("num/mul"));

// 4. fold: mul removed, so the add result flows directly → 5+10=15
await fold(spliced, defaults(app));`,
  },

  "dagql/wrapByName": {
    description:
      "Insert a wrapper node above a target — parents get rewired to the wrapper.",
    code: `// 1. make an app
const app = mvfm(prelude, console_);

// 2. make a program: x + 10
const prog = app({ x: "number" }, ($) =>
  $.begin($.console.log("result:", $.add($.input.x, 10)), $.add($.input.x, 10))
);

const injected = injectInput(prog, { x: 5 });

// 3. dagql: find the add node, wrap it, then splice to round-trip
const addIds = selectWhere(injected.__nexpr, byKind("num/add"));
const addId = [...addIds][0];
const wrapped = wrapByName(injected.__nexpr, addId, "num/mul");

// wrap then splice is a round-trip — the wrapper is removed
const roundTrip = spliceWhere(commit(wrapped), byKind("num/mul"));

// 4. fold the round-tripped result: still 5+10=15
await fold(roundTrip, defaults(app));`,
  },

  "dagql/name": {
    description:
      "Create named aliases for nodes — enables targeting by name instead of ID.",
    code: `// 1. make an app
const app = mvfm(prelude, console_);

// 2. make a program: (x + 10) * 2
const prog = app({ x: "number" }, ($) =>
  $.begin(
    $.console.log("result:", $.mul($.add($.input.x, 10), 2)),
    $.mul($.add($.input.x, 10), 2)
  )
);

const injected = injectInput(prog, { x: 5 });

// 3. dagql: name the add node, then target it by name
const addIds = selectWhere(injected.__nexpr, byKind("num/add"));
const addId = [...addIds][0];
const named = name(injected.__nexpr, "the-sum", addId);

// byName finds the target of the alias
const found = selectWhere(named, byName("the-sum"));
console.log("found by name:", found.size, "node(s)");

// replace by name instead of by kind
const rewritten = commit(
  replaceWhere(named, byName("the-sum"), "num/sub")
);

// 4. fold: was (5+10)*2=30, now (5-10)*2=-10
await fold(rewritten, defaults(app));`,
  },

  "dagql/gc": {
    description:
      "Remove unreachable nodes from the graph after mutations.",
    code: `// 1. make an app
const app = mvfm(prelude, console_);

// 2. make a program: (x + 10) * (x - 3)
const prog = app({ x: "number" }, ($) =>
  $.mul($.add($.input.x, 10), $.sub($.input.x, 3))
);

const injected = injectInput(prog, { x: 5 });

// 3. dagql: splice out mul (keeps first child = add), leaving sub orphaned
const spliced = spliceWhere(injected.__nexpr, byKind("num/mul"));

// sub node is now unreachable — gc removes it
const cleaned = commit(gc(dirty(spliced)));

console.log("before gc:", Object.keys(spliced.__adj).length, "nodes");
console.log("after gc:", Object.keys(cleaned.__adj).length, "nodes");

// 4. fold the cleaned result: add is now root → 5+10=15
await fold(cleaned, defaults(app));`,
  },
};

export { examples };
