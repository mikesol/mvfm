import type { NodeExample } from "./types";

const examples: Record<string, NodeExample> = {
  "core/begin": {
    description: "Sequential composition. Evaluates each argument in order, returns the last.",
    code: `// 1. make an app
const app = mvfm(prelude, console_);

// 2. make a program
const prog = app({ n: "number", name: "string" }, ($) => {
  const total = $.add($.input.n, 2);
  const greeting = $.concat($.input.name, " world");
  return $.begin(
    $.console.log(total),
    $.console.log(greeting),
    greeting
  );
});

// 3. run
await foldAST(
  defaults(app),
  injectInput(prog, { n: 40, name: "hello" })
);`,
  },
  "core/cond": {
    description: "Conditional branching. .t() for then, .f() for else. Either order.",
    code: `// 1. make an app
const app = mvfm(prelude, console_);

// 2. make a program
const prog = app({ x: "number" }, ($) => {
  const total = $.add($.input.x, 1);
  const big = $.gt(total, 100);
  return $.begin(
    $.console.log(
      $.cond(big)
        .t($.concat("big: ", $.show(total)))
        .f("small")
    ),
    total
  );
});

// 3. run
await foldAST(
  defaults(app),
  injectInput(prog, { x: 250 })
);`,
  },
  "core/literal": {
    description: "Creating literal values — raw JS values become MVFM expressions automatically",
    code: `// 1. make an app
const app = mvfm(prelude, console_);

// 2. make a program
const prog = app({ x: "number" }, ($) => {
  // Raw JS values (42, "hello") are auto-lifted to core/literal nodes
  const sum = $.add($.input.x, 42);
  const msg = $.concat("hello ", $.show(sum));
  return $.begin(
    $.console.log(msg),
    sum
  );
});

// 3. run
await foldAST(
  defaults(app),
  injectInput(prog, { x: 8 })
);`,
  },
  "core/input": {
    description: "External input injection — access injected data via $.input",
    code: `// 1. make an app
const app = mvfm(prelude, console_);

// 2. make a program — schema declares input shape
const prog = app({ name: "string", age: "number" }, ($) => {
  const greeting = $.concat("Hi, ", $.input.name);
  const nextAge = $.add($.input.age, 1);
  return $.begin(
    $.console.log(greeting),
    $.console.log($.concat("Next year: ", $.show(nextAge))),
    nextAge
  );
});

// 3. run — injectInput provides runtime values
await foldAST(
  defaults(app),
  injectInput(prog, { name: "Alice", age: 30 })
);`,
  },
  "core/record": {
    description: "Record construction — building an object with multiple named fields",
    code: `// 1. make an app
const app = mvfm(prelude, console_);

// 2. make a program
const prog = app({ x: "number", label: "string" }, ($) => {
  const doubled = $.mul($.input.x, 2);
  // Object literals auto-lift to core/record nodes
  const rec = { value: doubled, tag: $.input.label };
  return $.begin(
    $.console.log($.show(doubled)),
    rec
  );
});

// 3. run
await foldAST(
  defaults(app),
  injectInput(prog, { x: 5, label: "result" })
);`,
  },
  "core/tuple": {
    description: "Tuple construction — building an ordered collection of values",
    code: `// 1. make an app
const app = mvfm(prelude, console_);

// 2. make a program
const prog = app({ a: "number", b: "number" }, ($) => {
  const sum = $.add($.input.a, $.input.b);
  const diff = $.sub($.input.a, $.input.b);
  // Array literals auto-lift to core/tuple nodes
  const pair = [sum, diff];
  return $.begin(
    $.console.log($.concat("sum+diff: ", $.show(sum))),
    pair
  );
});

// 3. run
await foldAST(
  defaults(app),
  injectInput(prog, { a: 10, b: 3 })
);`,
  },
};

export default examples;
