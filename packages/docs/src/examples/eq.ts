import type { NodeExample } from "./types";

const examples: Record<string, NodeExample> = {
  "eq/neq": {
    description: "Structural inequality — negated equality via the eq typeclass",
    code: `const app = mvfm(prelude, console_);
const prog = app({ x: "number", y: "number" }, ($) => {
  const different = $.neq($.input.x, $.input.y);
  return $.begin(
    $.console.log($.cond(different).t("different").f("same")),
    different
  );
});
await foldAST(defaults(app), injectInput(prog, { x: 10, y: 20 }));`,
  },
};

export default examples;
