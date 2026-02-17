import type { NodeExample } from "./types";

const examples: Record<string, NodeExample> = {
  "ord/gt": {
    description: "Greater than comparison — dispatches to the ord typeclass",
    code: `const app = mvfm(prelude, console_);
const prog = app({ x: "number", y: "number" }, ($) => {
  const result = $.gt($.input.x, $.input.y);
  return $.begin(
    $.console.log($.cond(result).t("x is greater").f("x is not greater")),
    result
  );
});
await foldAST(defaults(app), injectInput(prog, { x: 10, y: 5 }));`,
  },
  "ord/gte": {
    description: "Greater than or equal comparison — dispatches to the ord typeclass",
    code: `const app = mvfm(prelude, console_);
const prog = app({ x: "number", y: "number" }, ($) => {
  const result = $.gte($.input.x, $.input.y);
  return $.begin(
    $.console.log($.cond(result).t("x >= y").f("x < y")),
    result
  );
});
await foldAST(defaults(app), injectInput(prog, { x: 7, y: 7 }));`,
  },
  "ord/lt": {
    description: "Less than comparison — dispatches to the ord typeclass",
    code: `const app = mvfm(prelude, console_);
const prog = app({ x: "number", y: "number" }, ($) => {
  const result = $.lt($.input.x, $.input.y);
  return $.begin(
    $.console.log($.cond(result).t("x < y").f("x >= y")),
    result
  );
});
await foldAST(defaults(app), injectInput(prog, { x: 3, y: 8 }));`,
  },
  "ord/lte": {
    description: "Less than or equal comparison — dispatches to the ord typeclass",
    code: `const app = mvfm(prelude, console_);
const prog = app({ x: "number", y: "number" }, ($) => {
  const result = $.lte($.input.x, $.input.y);
  return $.begin(
    $.console.log($.cond(result).t("x <= y").f("x > y")),
    result
  );
});
await foldAST(defaults(app), injectInput(prog, { x: 5, y: 10 }));`,
  },
};

export default examples;
