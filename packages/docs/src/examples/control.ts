import type { NodeExample } from "./types";

const controlMock = `({
  "control/each": async function* (node) {
    const collection = yield* eval_(node.collection);
    for (const item of collection) {
      for (const stmt of node.body) {
        const clone = structuredClone(stmt);
        yield recurseScoped(clone, [{ paramId: node.param.__id, value: item }]);
      }
    }
  },
  "control/while": async function* (node) {
    while (yield* eval_(structuredClone(node.condition))) {
      for (const stmt of node.body) {
        yield* eval_(structuredClone(stmt));
      }
    }
  },
})`;

const stAndControlMock = `(() => {
  const store = new Map();
  const ctrl = ${controlMock.trim()};
  return {
    ...ctrl,
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
  "control/each": {
    description: "Iterate over each element of an array, executing side effects",
    mockInterpreter: stAndControlMock,
    code: `// 1. make an app
const app = mvfm(prelude, console_, st, control);

// 2. make a program
const prog = app({ items: "string" }, ($) => {
  const count = $.let(0);
  $.each([$.input.items, "world", "!"], (item) => {
    count.set($.add(count.get(), 1));
  });
  return $.begin(
    $.console.log("total:", count.get()),
    count.get()
  );
});

// 3. run
await foldAST(
  defaults(app),
  injectInput(prog, { items: "hello" })
);`,
  },
  "control/while": {
    description: "Loop while a boolean condition remains true",
    mockInterpreter: stAndControlMock,
    code: `// 1. make an app
const app = mvfm(prelude, console_, st, control);

// 2. make a program
const prog = app({ limit: "number" }, ($) => {
  const i = $.let(0);
  $.while($.lt(i.get(), $.input.limit)).body(
    $.console.log("i =", i.get()),
    i.set($.add(i.get(), 1))
  );
  return $.begin(
    $.console.log("done at", i.get()),
    i.get()
  );
});

// 3. run
await foldAST(
  defaults(app),
  injectInput(prog, { limit: 4 })
);`,
  },
};

export default examples;
