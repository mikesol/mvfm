import type { NodeExample } from "./types";

const examples: Record<string, NodeExample> = {
  "num/add": {
    description: "Add two numbers via the semiring typeclass",
    code: `const app = mvfm(prelude, console_);
const prog = app({ x: "number" }, ($) => {
  const result = $.add($.input.x, 10);
  return $.begin($.console.log($.show(result)), result);
});
await foldAST(defaults(app), injectInput(prog, { x: 32 }));`,
  },
  "num/sub": {
    description: "Subtract one number from another",
    code: `const app = mvfm(prelude, console_);
const prog = app({ x: "number" }, ($) => {
  const result = $.sub($.input.x, 7);
  return $.begin($.console.log($.show(result)), result);
});
await foldAST(defaults(app), injectInput(prog, { x: 50 }));`,
  },
  "num/mul": {
    description: "Multiply two numbers via the semiring typeclass",
    code: `const app = mvfm(prelude, console_);
const prog = app({ x: "number" }, ($) => {
  const result = $.mul($.input.x, 3);
  return $.begin($.console.log($.show(result)), result);
});
await foldAST(defaults(app), injectInput(prog, { x: 14 }));`,
  },
  "num/div": {
    description: "Divide one number by another",
    code: `const app = mvfm(prelude, console_);
const prog = app({ x: "number" }, ($) => {
  const result = $.div($.input.x, 4);
  return $.begin($.console.log($.show(result)), result);
});
await foldAST(defaults(app), injectInput(prog, { x: 100 }));`,
  },
  "num/mod": {
    description: "Modulo (remainder) of two numbers",
    code: `const app = mvfm(prelude, console_);
const prog = app({ x: "number" }, ($) => {
  const result = $.mod($.input.x, 3);
  return $.begin($.console.log($.show(result)), result);
});
await foldAST(defaults(app), injectInput(prog, { x: 17 }));`,
  },
  "num/compare": {
    description: "Three-way comparison returning -1, 0, or 1 via the ord typeclass",
    code: `const app = mvfm(prelude, console_);
const prog = app({ x: "number", y: "number" }, ($) => {
  const result = $.compare($.input.x, $.input.y);
  return $.begin($.console.log($.show(result)), result);
});
await foldAST(defaults(app), injectInput(prog, { x: 5, y: 10 }));`,
  },
  "num/neg": {
    description: "Negate a number (flip its sign)",
    code: `const app = mvfm(prelude, console_);
const prog = app({ x: "number" }, ($) => {
  const result = $.neg($.input.x);
  return $.begin($.console.log($.show(result)), result);
});
await foldAST(defaults(app), injectInput(prog, { x: 42 }));`,
  },
  "num/abs": {
    description: "Absolute value of a number",
    code: `const app = mvfm(prelude, console_);
const prog = app({ x: "number" }, ($) => {
  const result = $.abs($.input.x);
  return $.begin($.console.log($.show(result)), result);
});
await foldAST(defaults(app), injectInput(prog, { x: -15 }));`,
  },
  "num/floor": {
    description: "Round a number down to the nearest integer",
    code: `const app = mvfm(prelude, console_);
const prog = app({ x: "number" }, ($) => {
  const result = $.floor($.input.x);
  return $.begin($.console.log($.show(result)), result);
});
await foldAST(defaults(app), injectInput(prog, { x: 7.8 }));`,
  },
  "num/ceil": {
    description: "Round a number up to the nearest integer",
    code: `const app = mvfm(prelude, console_);
const prog = app({ x: "number" }, ($) => {
  const result = $.ceil($.input.x);
  return $.begin($.console.log($.show(result)), result);
});
await foldAST(defaults(app), injectInput(prog, { x: 3.2 }));`,
  },
  "num/round": {
    description: "Round a number to the nearest integer",
    code: `const app = mvfm(prelude, console_);
const prog = app({ x: "number" }, ($) => {
  const result = $.round($.input.x);
  return $.begin($.console.log($.show(result)), result);
});
await foldAST(defaults(app), injectInput(prog, { x: 4.5 }));`,
  },
  "num/min": {
    description: "Minimum of one or more numbers",
    code: `const app = mvfm(prelude, console_);
const prog = app({ x: "number", y: "number" }, ($) => {
  const result = $.min($.input.x, $.input.y, 50);
  return $.begin($.console.log($.show(result)), result);
});
await foldAST(defaults(app), injectInput(prog, { x: 30, y: 75 }));`,
  },
  "num/max": {
    description: "Maximum of one or more numbers",
    code: `const app = mvfm(prelude, console_);
const prog = app({ x: "number", y: "number" }, ($) => {
  const result = $.max($.input.x, $.input.y, 10);
  return $.begin($.console.log($.show(result)), result);
});
await foldAST(defaults(app), injectInput(prog, { x: 30, y: 75 }));`,
  },
  "num/eq": {
    description: "Numeric equality — compares two numbers via the eq typeclass",
    code: `const app = mvfm(prelude, console_);
const prog = app({ x: "number", y: "number" }, ($) => {
  const same = $.eq($.input.x, $.input.y);
  return $.begin(
    $.console.log($.cond(same).t("equal").f("not equal")),
    same
  );
});
await foldAST(defaults(app), injectInput(prog, { x: 42, y: 42 }));`,
  },
  "num/zero": {
    description: "Semiring zero identity — the additive identity for numbers",
    code: `const app = mvfm(prelude, console_);
const prog = app({ x: "number" }, ($) => {
  // 0 is the semiring zero; adding it is an identity operation
  const result = $.add($.input.x, 0);
  return $.begin($.console.log($.show(result)), result);
});
await foldAST(defaults(app), injectInput(prog, { x: 99 }));`,
  },
  "num/one": {
    description: "Semiring one identity — the multiplicative identity for numbers",
    code: `const app = mvfm(prelude, console_);
const prog = app({ x: "number" }, ($) => {
  // 1 is the semiring one; multiplying by it is an identity operation
  const result = $.mul($.input.x, 1);
  return $.begin($.console.log($.show(result)), result);
});
await foldAST(defaults(app), injectInput(prog, { x: 42 }));`,
  },
  "num/show": {
    description: "Convert a number to its string representation via the Show typeclass",
    code: `const app = mvfm(prelude, console_);
const prog = app({ x: "number" }, ($) => {
  // $.show dispatches to num/show for numeric expressions
  const label = $.concat("value is: ", $.show($.input.x));
  return $.begin($.console.log(label), $.input.x);
});
await foldAST(defaults(app), injectInput(prog, { x: 123 }));`,
  },
  "num/top": {
    description: "Bounded top for numbers — represents the maximum value",
    code: `const app = mvfm(prelude, console_);
const prog = app({ x: "number" }, ($) => {
  // Compare input against a large known value
  const capped = $.min($.input.x, 1000);
  return $.begin($.console.log($.show(capped)), capped);
});
await foldAST(defaults(app), injectInput(prog, { x: 9999 }));`,
  },
  "num/bottom": {
    description: "Bounded bottom for numbers — represents the minimum value",
    code: `const app = mvfm(prelude, console_);
const prog = app({ x: "number" }, ($) => {
  // Clamp input to at least 0
  const clamped = $.max($.input.x, 0);
  return $.begin($.console.log($.show(clamped)), clamped);
});
await foldAST(defaults(app), injectInput(prog, { x: -5 }));`,
  },
};

export default examples;
