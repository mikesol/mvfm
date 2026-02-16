import type { NodeExample } from "./types";

const examples: Record<string, NodeExample> = {
  "core/begin": {
    description:
      "Sequential composition. Evaluates each argument in order, returns the last.",
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
    description:
      "Conditional branching. .t() for then, .f() for else. Either order.",
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
};

export default examples;
