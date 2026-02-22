import type { NodeExample } from "./types";

const examples: Record<string, NodeExample> = {
  "fiber/par_map": {
    description: "Map over a collection with bounded concurrency",
    code: `// 1. make an app
const app = mvfm(prelude, fiber);

// 2. make a program
const prog = app({ nums: array("number") }, ($) => {
  return $.par($.input.nums, { concurrency: 2 }, (n) =>
    $.mul(n, 10)
  );
});

// 3. run
await fold(
  defaults(app),
  injectInput(prog, { nums: [1, 2, 3, 4] })
);`,
  },
  "fiber/race": {
    description: "Run expressions concurrently, returning the first to complete",
    code: `// 1. make an app
const app = mvfm(prelude, fiber);

// 2. make a program
const prog = app({ x: "number" }, ($) => {
  const fast = $.add($.input.x, 1);
  const slow = $.mul($.input.x, 100);
  return $.race(fast, slow);
});

// 3. run
await fold(
  defaults(app),
  injectInput(prog, { x: 5 })
);`,
  },
  "fiber/timeout": {
    description: "Timeout an expression with a fallback value if it exceeds the limit",
    code: `// 1. make an app
const app = mvfm(prelude, fiber);

// 2. make a program
const prog = app({ x: "number" }, ($) => {
  const computation = $.mul($.input.x, $.input.x);
  return $.timeout(computation, 5000, -1);
});

// 3. run
await fold(
  defaults(app),
  injectInput(prog, { x: 7 })
);`,
  },
  "fiber/retry": {
    description: "Retry an expression up to N times with optional delay between attempts",
    code: `// 1. make an app
const app = mvfm(prelude, fiber);

// 2. make a program
const prog = app({ base: "number" }, ($) => {
  const value = $.add($.input.base, 42);
  return $.retry(value, { attempts: 3, delay: 100 });
});

// 3. run
await fold(
  defaults(app),
  injectInput(prog, { base: 8 })
);`,
  },
};

export default examples;
