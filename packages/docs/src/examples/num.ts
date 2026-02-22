import type { NodeExample } from "./types";

const examples: Record<string, NodeExample> = {
  "num/add": {
    description: "Add two numbers via the semiring typeclass",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number" }, ($) => {
  return $.add($.input.x, 10);
});
await fold(defaults(app), injectInput(prog, { x: 32 }));`,
  },
  "num/sub": {
    description: "Subtract one number from another",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number" }, ($) => {
  return $.sub($.input.x, 7);
});
await fold(defaults(app), injectInput(prog, { x: 50 }));`,
  },
  "num/mul": {
    description: "Multiply two numbers via the semiring typeclass",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number" }, ($) => {
  return $.mul($.input.x, 3);
});
await fold(defaults(app), injectInput(prog, { x: 14 }));`,
  },
  "num/div": {
    description: "Divide one number by another",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number" }, ($) => {
  return $.div($.input.x, 4);
});
await fold(defaults(app), injectInput(prog, { x: 100 }));`,
  },
  "num/mod": {
    description: "Modulo (remainder) of two numbers",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number" }, ($) => {
  return $.mod($.input.x, 3);
});
await fold(defaults(app), injectInput(prog, { x: 17 }));`,
  },
  "num/compare": {
    description: "Three-way comparison returning -1, 0, or 1 via the ord typeclass",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number", y: "number" }, ($) => {
  return $.compare($.input.x, $.input.y);
});
await fold(defaults(app), injectInput(prog, { x: 5, y: 10 }));`,
  },
  "num/neg": {
    description: "Negate a number (flip its sign)",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number" }, ($) => {
  return $.neg($.input.x);
});
await fold(defaults(app), injectInput(prog, { x: 42 }));`,
  },
  "num/abs": {
    description: "Absolute value of a number",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number" }, ($) => {
  return $.abs($.input.x);
});
await fold(defaults(app), injectInput(prog, { x: -15 }));`,
  },
  "num/floor": {
    description: "Round a number down to the nearest integer",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number" }, ($) => {
  return $.floor($.input.x);
});
await fold(defaults(app), injectInput(prog, { x: 7.8 }));`,
  },
  "num/ceil": {
    description: "Round a number up to the nearest integer",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number" }, ($) => {
  return $.ceil($.input.x);
});
await fold(defaults(app), injectInput(prog, { x: 3.2 }));`,
  },
  "num/round": {
    description: "Round a number to the nearest integer",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number" }, ($) => {
  return $.round($.input.x);
});
await fold(defaults(app), injectInput(prog, { x: 4.5 }));`,
  },
  "num/min": {
    description: "Minimum of one or more numbers",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number", y: "number" }, ($) => {
  return $.min($.input.x, $.input.y, 50);
});
await fold(defaults(app), injectInput(prog, { x: 30, y: 75 }));`,
  },
  "num/max": {
    description: "Maximum of one or more numbers",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number", y: "number" }, ($) => {
  return $.max($.input.x, $.input.y, 10);
});
await fold(defaults(app), injectInput(prog, { x: 30, y: 75 }));`,
  },
  "num/eq": {
    description: "Numeric equality — compares two numbers via the eq typeclass",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number", y: "number" }, ($) => {
  return $.eq($.input.x, $.input.y);
});
await fold(defaults(app), injectInput(prog, { x: 42, y: 42 }));`,
  },
  "num/neq": {
    description: "Numeric inequality — true when two numbers differ",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number", y: "number" }, ($) => {
  return $.neq($.input.x, $.input.y);
});
await fold(defaults(app), injectInput(prog, { x: 10, y: 20 }));`,
  },
  "num/literal": {
    description: "Lift a JS number into the DSL as a numeric literal node",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number" }, ($) => {
  // Raw numbers are lifted to num/literal nodes automatically
  return $.add($.input.x, 100);
});
await fold(defaults(app), injectInput(prog, { x: 5 }));`,
  },
  "num/gt": {
    description: "Numeric greater than — dispatches from the ord typeclass for numbers",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number", y: "number" }, ($) => {
  return $.gt($.input.x, $.input.y);
});
await fold(defaults(app), injectInput(prog, { x: 10, y: 5 }));`,
  },
  "num/gte": {
    description: "Numeric greater than or equal — dispatches from the ord typeclass for numbers",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number", y: "number" }, ($) => {
  return $.gte($.input.x, $.input.y);
});
await fold(defaults(app), injectInput(prog, { x: 7, y: 7 }));`,
  },
  "num/lt": {
    description: "Numeric less than — dispatches from the ord typeclass for numbers",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number", y: "number" }, ($) => {
  return $.lt($.input.x, $.input.y);
});
await fold(defaults(app), injectInput(prog, { x: 3, y: 8 }));`,
  },
  "num/lte": {
    description: "Numeric less than or equal — dispatches from the ord typeclass for numbers",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number", y: "number" }, ($) => {
  return $.lte($.input.x, $.input.y);
});
await fold(defaults(app), injectInput(prog, { x: 5, y: 10 }));`,
  },
  "num/zero": {
    description: "Semiring zero identity — the additive identity for numbers",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number" }, ($) => {
  // 0 is the semiring zero; adding it is an identity operation
  return $.add($.input.x, 0);
});
await fold(defaults(app), injectInput(prog, { x: 99 }));`,
  },
  "num/one": {
    description: "Semiring one identity — the multiplicative identity for numbers",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number" }, ($) => {
  // 1 is the semiring one; multiplying by it is an identity operation
  return $.mul($.input.x, 1);
});
await fold(defaults(app), injectInput(prog, { x: 42 }));`,
  },
  "num/show": {
    description: "Convert a number to its string representation via the Show typeclass",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number" }, ($) => {
  // $.show dispatches to num/show for numeric expressions
  return $.concat("value is: ", $.show($.input.x));
});
await fold(defaults(app), injectInput(prog, { x: 123 }));`,
  },
  "num/top": {
    description: "Bounded top for numbers — represents the maximum value",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number" }, ($) => {
  // Compare input against a large known value
  return $.min($.input.x, 1000);
});
await fold(defaults(app), injectInput(prog, { x: 9999 }));`,
  },
  "num/bottom": {
    description: "Bounded bottom for numbers — represents the minimum value",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number" }, ($) => {
  // Clamp input to at least 0
  return $.max($.input.x, 0);
});
await fold(defaults(app), injectInput(prog, { x: -5 }));`,
  },
};

export { examples };
