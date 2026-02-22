import type { NodeExample } from "./types";

const examples: Record<string, NodeExample> = {
  "st/let": {
    description: "Declare a mutable local variable with an initial value",
    code: `// 1. make an app
const app = mvfm(prelude, st);

// 2. make a program
const prog = app({ n: "number" }, ($) => {
  const counter = $.let($.input.n);
  return counter.get();
});

// 3. run
await fold(
  defaults(app),
  injectInput(prog, { n: 10 })
);`,
  },
  "st/get": {
    description: "Read the current value of a mutable variable",
    code: `// 1. make an app
const app = mvfm(prelude, st);

// 2. make a program
const prog = app({ x: "number" }, ($) => {
  const val = $.let($.add($.input.x, 5));
  return val.get();
});

// 3. run
await fold(
  defaults(app),
  injectInput(prog, { x: 7 })
);`,
  },
  "st/set": {
    description: "Overwrite a mutable variable with a new value",
    code: `// 1. make an app
const app = mvfm(prelude, st);

// 2. make a program
const prog = app({ x: "number" }, ($) => {
  const cell = $.let(0);
  cell.set($.mul($.input.x, 2));
  return cell.get();
});

// 3. run
await fold(
  defaults(app),
  injectInput(prog, { x: 21 })
);`,
  },
  "st/push": {
    description: "Append a value to a mutable array variable",
    code: `// 1. make an app
const app = mvfm(prelude, st);

// 2. make a program
const prog = app({ x: "number" }, ($) => {
  const items = $.let([]);
  items.push($.input.x);
  items.push($.add($.input.x, 1));
  return items.get();
});

// 3. run
await fold(
  defaults(app),
  injectInput(prog, { x: 5 })
);`,
  },
};

export default examples;
