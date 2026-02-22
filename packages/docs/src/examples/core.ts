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
await fold(
  defaults(app),
  injectInput(prog, { n: 40, name: "hello" })
);`,
  },
  "core/cond": {
    description: "Conditional branching. .t() for then, .f() for else. Either order.",
    code: `// 1. make an app
const app = mvfm(prelude);

// 2. make a program
const prog = app({ x: "number" }, ($) => {
  const total = $.add($.input.x, 1);
  const big = $.gt(total, 100);
  return $.cond(big)
    .t($.concat("big: ", $.show(total)))
    .f("small");
});

// 3. run
await fold(
  defaults(app),
  injectInput(prog, { x: 250 })
);`,
  },
  "core/literal": {
    description: "Creating literal values — raw JS values become MVFM expressions automatically",
    code: `// 1. make an app
const app = mvfm(prelude);

// 2. make a program
const prog = app({ x: "number" }, ($) => {
  // Raw JS values (42, "hello") are auto-lifted to core/literal nodes
  return $.add($.input.x, 42);
});

// 3. run
await fold(
  defaults(app),
  injectInput(prog, { x: 8 })
);`,
  },
  "core/input": {
    description: "External input injection — access injected data via $.input",
    code: `// 1. make an app
const app = mvfm(prelude);

// 2. make a program — schema declares input shape
const prog = app({ name: "string", age: "number" }, ($) => {
  const greeting = $.concat("Hi, ", $.input.name);
  const nextAge = $.add($.input.age, 1);
  return { greeting, nextAge };
});

// 3. run — injectInput provides runtime values
await fold(
  defaults(app),
  injectInput(prog, { name: "Alice", age: 30 })
);`,
  },
  "core/record": {
    description: "Record construction — building an object with multiple named fields",
    code: `// 1. make an app
const app = mvfm(prelude);

// 2. make a program
const prog = app({ x: "number", label: "string" }, ($) => {
  const doubled = $.mul($.input.x, 2);
  // Object literals auto-lift to core/record nodes
  return { value: doubled, tag: $.input.label };
});

// 3. run
await fold(
  defaults(app),
  injectInput(prog, { x: 5, label: "result" })
);`,
  },
  "core/tuple": {
    description: "Tuple construction — building an ordered collection of values",
    code: `// 1. make an app
const app = mvfm(prelude);

// 2. make a program
const prog = app({ a: "number", b: "number" }, ($) => {
  const sum = $.add($.input.a, $.input.b);
  const diff = $.sub($.input.a, $.input.b);
  // Array literals auto-lift to core/tuple nodes
  return [sum, diff];
});

// 3. run
await fold(
  defaults(app),
  injectInput(prog, { a: 10, b: 3 })
);`,
  },
};

export default examples;
