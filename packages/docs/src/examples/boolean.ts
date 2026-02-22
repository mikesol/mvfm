import type { NodeExample } from "./types";

const examples: Record<string, NodeExample> = {
  "bool/and": {
    description: "Logical AND — both conditions must be true",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number", y: "number" }, ($) => {
  return $.and($.gt($.input.x, 0), $.gt($.input.y, 0));
});
await fold(defaults(app), injectInput(prog, { x: 5, y: 3 }));`,
  },
  "bool/or": {
    description: "Logical OR — at least one condition must be true",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number", y: "number" }, ($) => {
  return $.or($.gt($.input.x, 10), $.gt($.input.y, 10));
});
await fold(defaults(app), injectInput(prog, { x: 3, y: 15 }));`,
  },
  "bool/not": {
    description: "Logical NOT — negates a boolean expression",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number" }, ($) => {
  const isSmall = $.lt($.input.x, 10);
  return $.not(isSmall);
});
await fold(defaults(app), injectInput(prog, { x: 42 }));`,
  },
  "bool/eq": {
    description: "Boolean equality — compares two boolean expressions",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number", y: "number" }, ($) => {
  // Wrap in $.not to produce boolean-typed nodes for eq dispatch
  const xNeg = $.not($.gt($.input.x, 0));
  const yNeg = $.not($.gt($.input.y, 0));
  return $.eq(xNeg, yNeg);
});
await fold(defaults(app), injectInput(prog, { x: 5, y: -3 }));`,
  },
  "bool/neq": {
    description: "Boolean inequality — true when two boolean expressions differ",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number", y: "number" }, ($) => {
  const xPos = $.not($.not($.gt($.input.x, 0)));
  const yPos = $.not($.not($.gt($.input.y, 0)));
  return $.neq(xPos, yPos);
});
await fold(defaults(app), injectInput(prog, { x: 5, y: -3 }));`,
  },
  "bool/ff": {
    description: "Boolean false literal — the heytingAlgebra identity for disjunction",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number" }, ($) => {
  // false auto-lifts to a boolean literal
  return $.or($.gt($.input.x, 100), false);
});
await fold(defaults(app), injectInput(prog, { x: 42 }));`,
  },
  "bool/tt": {
    description: "Boolean true literal — the heytingAlgebra identity for conjunction",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number" }, ($) => {
  // true auto-lifts to a boolean literal
  return $.and(true, $.gt($.input.x, 0));
});
await fold(defaults(app), injectInput(prog, { x: 7 }));`,
  },
  "bool/literal": {
    description: "Lift a JS boolean into the DSL as a boolean literal node",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number" }, ($) => {
  // Raw booleans are lifted to bool/literal nodes automatically
  const alwaysTrue = true;
  return $.and(alwaysTrue, $.gt($.input.x, 0));
});
await fold(defaults(app), injectInput(prog, { x: 10 }));`,
  },
  "bool/implies": {
    description: "Logical implication — if A then B, equivalent to or(not(A), B)",
    code: `const app = mvfm(prelude);
const prog = app({ age: "number" }, ($) => {
  const isAdult = $.gte($.input.age, 18);
  const canDrive = $.gte($.input.age, 16);
  // A implies B is equivalent to or(not(A), B)
  return $.or($.not(isAdult), canDrive);
});
await fold(defaults(app), injectInput(prog, { age: 21 }));`,
  },
  "bool/show": {
    description: "Convert a boolean to its string representation via the Show typeclass",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number" }, ($) => {
  // Wrap in $.not($.not(...)) to produce a boolean-typed node for show dispatch
  const isPositive = $.not($.not($.gt($.input.x, 0)));
  // $.show dispatches to bool/show for boolean expressions
  return $.concat("positive: ", $.show(isPositive));
});
await fold(defaults(app), injectInput(prog, { x: 5 }));`,
  },
};

export default examples;
