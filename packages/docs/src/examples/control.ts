import type { NodeExample } from "./types";

const examples: Record<string, NodeExample> = {
  "control/each": {
    description: "Iterate over each element of an array, executing side effects",
    code: `// 1. make an app
const app = mvfm(prelude, st, control);

// 2. make a program
const prog = app({ x: "number", y: "number" }, ($) => {
  const sum = $.let(0);
  $.each([$.input.x, 10, $.input.y], (item) => {
    sum.set($.add(sum.get(), item));
  });
  return sum.get();
});

// 3. run
await fold(
  defaults(app),
  injectInput(prog, { x: 1, y: 100 })
);`,
  },
  "control/while": {
    description: "Loop while a boolean condition remains true",
    code: `// 1. make an app
const app = mvfm(prelude, st, control);

// 2. make a program
const prog = app({ limit: "number" }, ($) => {
  const i = $.let(0);
  $.while($.lt(i.get(), $.input.limit)).body(() => {
    i.set($.add(i.get(), 1));
  });
  return i.get();
});

// 3. run
await fold(
  defaults(app),
  injectInput(prog, { limit: 4 })
);`,
  },
};

export default examples;
