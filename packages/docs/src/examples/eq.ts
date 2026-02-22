import type { NodeExample } from "./types";

const examples: Record<string, NodeExample> = {
  "eq/eq": {
    description: "Structural equality — dispatches to type-specific implementations",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number", y: "number" }, ($) => {
  return $.eq($.input.x, $.input.y);
});
await fold(defaults(app), injectInput(prog, { x: 10, y: 10 }));`,
  },
  "eq/neq": {
    description: "Structural inequality — negated equality via the eq typeclass",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number", y: "number" }, ($) => {
  return $.neq($.input.x, $.input.y);
});
await fold(defaults(app), injectInput(prog, { x: 10, y: 20 }));`,
  },
};

export default examples;
