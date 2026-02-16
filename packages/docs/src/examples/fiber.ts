import type { NodeExample } from "./types";

const examples: Record<string, NodeExample> = {
  "fiber/par_map": {
    description: "Map over a collection with bounded concurrency",
    code: `// 1. make an app
const app = mvfm(prelude, console_, fiber);

// 2. make a program
const prog = app({ factor: "number" }, ($) => {
  const nums = [1, 2, 3, 4];
  const doubled = $.par(nums, { concurrency: 2 }, (n) =>
    $.mul(n, $.input.factor)
  );
  return $.begin(
    $.console.log(doubled),
    doubled
  );
});

// 3. run
await foldAST(
  defaults(app),
  injectInput(prog, { factor: 10 })
);`,
  },
  "fiber/race": {
    description: "Run expressions concurrently, returning the first to complete",
    code: `// 1. make an app
const app = mvfm(prelude, console_, fiber);

// 2. make a program
const prog = app({ x: "number" }, ($) => {
  const fast = $.add($.input.x, 1);
  const slow = $.mul($.input.x, 100);
  const winner = $.race(fast, slow);
  return $.begin(
    $.console.log($.concat("winner: ", $.show(winner))),
    winner
  );
});

// 3. run
await foldAST(
  defaults(app),
  injectInput(prog, { x: 5 })
);`,
  },
  "fiber/timeout": {
    description: "Timeout an expression with a fallback value if it exceeds the limit",
    code: `// 1. make an app
const app = mvfm(prelude, console_, fiber);

// 2. make a program
const prog = app({ x: "number" }, ($) => {
  const computation = $.mul($.input.x, $.input.x);
  const safe = $.timeout(computation, 5000, -1);
  return $.begin(
    $.console.log($.concat("result: ", $.show(safe))),
    safe
  );
});

// 3. run
await foldAST(
  defaults(app),
  injectInput(prog, { x: 7 })
);`,
  },
  "fiber/retry": {
    description: "Retry an expression up to N times with optional delay between attempts",
    code: `// 1. make an app
const app = mvfm(prelude, console_, fiber);

// 2. make a program
const prog = app({ base: "number" }, ($) => {
  const value = $.add($.input.base, 42);
  const reliable = $.retry(value, { attempts: 3, delay: 100 });
  return $.begin(
    $.console.log($.concat("got: ", $.show(reliable))),
    reliable
  );
});

// 3. run
await foldAST(
  defaults(app),
  injectInput(prog, { base: 8 })
);`,
  },
};

export default examples;
