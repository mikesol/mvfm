import type { NodeExample } from "./types";

const examples: Record<string, NodeExample> = {
  "boolean/and": {
    description: "Logical AND — both conditions must be true",
    code: `// 1. make an app
const app = mvfm(prelude, console_);

// 2. make a program
const prog = app({ x: "number", y: "number" }, ($) => {
  const both = $.and($.gt($.input.x, 0), $.gt($.input.y, 0));
  return $.begin(
    $.console.log($.cond(both).t("both positive").f("not both positive")),
    both
  );
});

// 3. run
await foldAST(
  defaults(app),
  injectInput(prog, { x: 5, y: 3 })
);`,
  },
  "boolean/or": {
    description: "Logical OR — at least one condition must be true",
    code: `// 1. make an app
const app = mvfm(prelude, console_);

// 2. make a program
const prog = app({ x: "number", y: "number" }, ($) => {
  const either = $.or($.gt($.input.x, 10), $.gt($.input.y, 10));
  return $.begin(
    $.console.log($.cond(either).t("at least one > 10").f("neither > 10")),
    either
  );
});

// 3. run
await foldAST(
  defaults(app),
  injectInput(prog, { x: 3, y: 15 })
);`,
  },
  "boolean/not": {
    description: "Logical NOT — negates a boolean expression",
    code: `// 1. make an app
const app = mvfm(prelude, console_);

// 2. make a program
const prog = app({ x: "number" }, ($) => {
  const isSmall = $.lt($.input.x, 10);
  const isNotSmall = $.not(isSmall);
  return $.begin(
    $.console.log($.cond(isNotSmall).t("not small").f("small")),
    isNotSmall
  );
});

// 3. run
await foldAST(
  defaults(app),
  injectInput(prog, { x: 42 })
);`,
  },
  "boolean/eq": {
    description: "Boolean equality — compares two boolean expressions",
    code: `// 1. make an app
const app = mvfm(prelude, console_);

// 2. make a program
const prog = app({ x: "number", y: "number" }, ($) => {
  // Wrap in $.not to produce boolean-typed nodes for eq dispatch
  const xNeg = $.not($.gt($.input.x, 0));
  const yNeg = $.not($.gt($.input.y, 0));
  const same = $.eq(xNeg, yNeg);
  return $.begin(
    $.console.log($.cond(same).t("same sign").f("different sign")),
    same
  );
});

// 3. run
await foldAST(
  defaults(app),
  injectInput(prog, { x: 5, y: -3 })
);`,
  },
  "boolean/ff": {
    description: "Boolean false literal — the heytingAlgebra identity for disjunction",
    code: `// 1. make an app
const app = mvfm(prelude, console_);

// 2. make a program
const prog = app({ x: "number" }, ($) => {
  // false auto-lifts to a boolean literal
  const result = $.or($.gt($.input.x, 100), false);
  return $.begin(
    $.console.log($.cond(result).t("big").f("not big")),
    result
  );
});

// 3. run
await foldAST(
  defaults(app),
  injectInput(prog, { x: 42 })
);`,
  },
  "boolean/tt": {
    description: "Boolean true literal — the heytingAlgebra identity for conjunction",
    code: `// 1. make an app
const app = mvfm(prelude, console_);

// 2. make a program
const prog = app({ x: "number" }, ($) => {
  // true auto-lifts to a boolean literal
  const result = $.and(true, $.gt($.input.x, 0));
  return $.begin(
    $.console.log($.cond(result).t("positive").f("not positive")),
    result
  );
});

// 3. run
await foldAST(
  defaults(app),
  injectInput(prog, { x: 7 })
);`,
  },
  "boolean/implies": {
    description: "Logical implication — if A then B, equivalent to or(not(A), B)",
    code: `// 1. make an app
const app = mvfm(prelude, console_);

// 2. make a program
const prog = app({ age: "number" }, ($) => {
  const isAdult = $.gte($.input.age, 18);
  const canDrive = $.gte($.input.age, 16);
  // A implies B is equivalent to or(not(A), B)
  const valid = $.or($.not(isAdult), canDrive);
  return $.begin(
    $.console.log($.cond(valid).t("consistent").f("inconsistent")),
    valid
  );
});

// 3. run
await foldAST(
  defaults(app),
  injectInput(prog, { age: 21 })
);`,
  },
  "boolean/show": {
    description: "Convert a boolean to its string representation via the Show typeclass",
    code: `// 1. make an app
const app = mvfm(prelude, console_);

// 2. make a program
const prog = app({ x: "number" }, ($) => {
  // Wrap in $.not($.not(...)) to produce a boolean-typed node for show dispatch
  const isPositive = $.not($.not($.gt($.input.x, 0)));
  // $.show dispatches to boolean/show for boolean expressions
  const label = $.concat("positive: ", $.show(isPositive));
  return $.begin(
    $.console.log(label),
    isPositive
  );
});

// 3. run
await foldAST(
  defaults(app),
  injectInput(prog, { x: 5 })
);`,
  },
  "boolean/top": {
    description: "Bounded top for boolean — the maximum value (true)",
    code: `// 1. make an app
const app = mvfm(prelude, console_);

// 2. make a program
const prog = app({ x: "number" }, ($) => {
  // true is the top (maximum) of the boolean bounded type
  const check = $.and(true, $.gt($.input.x, 0));
  return $.begin(
    $.console.log($.show(check)),
    check
  );
});

// 3. run
await foldAST(
  defaults(app),
  injectInput(prog, { x: 10 })
);`,
  },
  "boolean/bottom": {
    description: "Bounded bottom for boolean — the minimum value (false)",
    code: `// 1. make an app
const app = mvfm(prelude, console_);

// 2. make a program
const prog = app({ x: "number" }, ($) => {
  // false is the bottom (minimum) of the boolean bounded type
  const check = $.or(false, $.gt($.input.x, 0));
  return $.begin(
    $.console.log($.show(check)),
    check
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
