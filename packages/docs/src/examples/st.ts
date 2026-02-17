import type { NodeExample } from "./types";

const stMock = `(() => {
  const store = new Map();
  return {
    "st/let": async function* (node) {
      const initial = yield* eval_(node.initial);
      store.set(node.ref, initial);
    },
    "st/get": async function* (node) {
      return store.get(node.ref);
    },
    "st/set": async function* (node) {
      store.set(node.ref, yield* eval_(node.value));
    },
    "st/push": async function* (node) {
      store.get(node.ref).push(yield* eval_(node.value));
    },
  };
})()`;

const examples: Record<string, NodeExample> = {
  "st/let": {
    description: "Declare a mutable local variable with an initial value",
    mockInterpreter: stMock,
    code: `// 1. make an app
const app = mvfm(prelude, console_, st);

// 2. make a program
const prog = app({ n: "number" }, ($) => {
  const counter = $.let($.input.n);
  return $.begin(
    $.console.log("initial:", counter.get()),
    counter.get()
  );
});

// 3. run
await foldAST(
  defaults(app),
  injectInput(prog, { n: 10 })
);`,
  },
  "st/get": {
    description: "Read the current value of a mutable variable",
    mockInterpreter: stMock,
    code: `// 1. make an app
const app = mvfm(prelude, console_, st);

// 2. make a program
const prog = app({ x: "number" }, ($) => {
  const val = $.let($.add($.input.x, 5));
  return $.begin(
    $.console.log("computed:", val.get()),
    val.get()
  );
});

// 3. run
await foldAST(
  defaults(app),
  injectInput(prog, { x: 7 })
);`,
  },
  "st/set": {
    description: "Overwrite a mutable variable with a new value",
    mockInterpreter: stMock,
    code: `// 1. make an app
const app = mvfm(prelude, console_, st);

// 2. make a program
const prog = app({ x: "number" }, ($) => {
  const cell = $.let(0);
  cell.set($.mul($.input.x, 2));
  return $.begin(
    $.console.log("doubled:", cell.get()),
    cell.get()
  );
});

// 3. run
await foldAST(
  defaults(app),
  injectInput(prog, { x: 21 })
);`,
  },
  "st/push": {
    description: "Append a value to a mutable array variable",
    mockInterpreter: stMock,
    code: `// 1. make an app
const app = mvfm(prelude, console_, st);

// 2. make a program
const prog = app({ x: "number" }, ($) => {
  const items = $.let([]);
  items.push($.input.x);
  items.push($.add($.input.x, 1));
  return $.begin(
    $.console.log("items:", items.get()),
    items.get()
  );
});

// 3. run
await foldAST(
  defaults(app),
  injectInput(prog, { x: 5 })
);`,
  },
};

export default examples;
