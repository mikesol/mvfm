import type { NodeExample } from "./types";

const examples: Record<string, NodeExample> = {
  "ord/gt": {
    description: "Greater than comparison — dispatches to the ord typeclass",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number", y: "number" }, ($) => {
  return $.gt($.input.x, $.input.y);
});
await fold(defaults(app), injectInput(prog, { x: 10, y: 5 }));`,
  },
  "ord/gte": {
    description: "Greater than or equal comparison — dispatches to the ord typeclass",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number", y: "number" }, ($) => {
  return $.gte($.input.x, $.input.y);
});
await fold(defaults(app), injectInput(prog, { x: 7, y: 7 }));`,
  },
  "ord/lt": {
    description: "Less than comparison — dispatches to the ord typeclass",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number", y: "number" }, ($) => {
  return $.lt($.input.x, $.input.y);
});
await fold(defaults(app), injectInput(prog, { x: 3, y: 8 }));`,
  },
  "ord/lte": {
    description: "Less than or equal comparison — dispatches to the ord typeclass",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number", y: "number" }, ($) => {
  return $.lte($.input.x, $.input.y);
});
await fold(defaults(app), injectInput(prog, { x: 5, y: 10 }));`,
  },
};

export default examples;
