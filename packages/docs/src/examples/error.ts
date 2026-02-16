import type { NodeExample } from "./types";

const examples: Record<string, NodeExample> = {
  "error/try": {
    description: "Attempt an expression and recover from failure with a catch branch",
    code: `// 1. make an app
const app = mvfm(prelude, console_, error);

// 2. make a program
const prog = app({ x: "number" }, ($) => {
  const risky = $.cond($.gt($.input.x, 10))
    .t($.input.x)
    .f($.fail("too small"));
  const safe = $.try(risky).catch((err) =>
    $.concat("recovered: ", err)
  );
  return $.begin(
    $.console.log(safe),
    safe
  );
});

// 3. run
await foldAST(
  defaults(app),
  injectInput(prog, { x: 3 })
);`,
  },
  "error/fail": {
    description: "Explicitly fail with an error value, like throw for the DSL",
    code: `// 1. make an app
const app = mvfm(prelude, console_, error);

// 2. make a program
const prog = app({ age: "number" }, ($) => {
  const checked = $.cond($.gte($.input.age, 18))
    .t($.concat("welcome, age ", $.show($.input.age)))
    .f($.fail("must be 18+"));
  const result = $.try(checked).catch((err) =>
    $.concat("denied: ", err)
  );
  return $.begin(
    $.console.log(result),
    result
  );
});

// 3. run
await foldAST(
  defaults(app),
  injectInput(prog, { age: 15 })
);`,
  },
  "error/attempt": {
    description: "Wrap an expression in an Either-style result with ok and err fields",
    code: `// 1. make an app
const app = mvfm(prelude, console_, error);

// 2. make a program
const prog = app({ x: "number" }, ($) => {
  const risky = $.cond($.gt($.input.x, 0))
    .t($.mul($.input.x, 10))
    .f($.fail("non-positive"));
  const result = $.attempt(risky);
  return $.begin(
    $.console.log(result),
    result
  );
});

// 3. run
await foldAST(
  defaults(app),
  injectInput(prog, { x: -5 })
);`,
  },
  "error/guard": {
    description: "Assert a condition, failing with an error if it is false",
    code: `// 1. make an app
const app = mvfm(prelude, console_, error);

// 2. make a program
const prog = app({ balance: "number" }, ($) => {
  const withdrawal = 50;
  const result = $.try(
    $.begin(
      $.guard($.gte($.input.balance, withdrawal), "insufficient funds"),
      $.sub($.input.balance, withdrawal)
    )
  ).catch((err) => $.concat("error: ", err));
  return $.begin(
    $.console.log(result),
    result
  );
});

// 3. run
await foldAST(
  defaults(app),
  injectInput(prog, { balance: 30 })
);`,
  },
  "error/settle": {
    description: "Collect results from multiple expressions, accumulating successes and failures",
    code: `// 1. make an app
const app = mvfm(prelude, console_, error);

// 2. make a program
const prog = app({ x: "number" }, ($) => {
  const a = $.mul($.input.x, 2);
  const b = $.cond($.gt($.input.x, 5))
    .t($.input.x)
    .f($.fail("x too small"));
  const c = $.add($.input.x, 100);
  const results = $.settle(a, b, c);
  return $.begin(
    $.console.log(results),
    results
  );
});

// 3. run
await foldAST(
  defaults(app),
  injectInput(prog, { x: 3 })
);`,
  },
};

export default examples;
