import { coreIndexes } from "./indexes-core";
import { externalIndexes } from "./indexes-external";
import type { NamespaceIndex } from "./types";

const indexes: Record<string, NamespaceIndex> = {
  ...coreIndexes,

  dagql: {
    content: `<p>Programs are data. Once you build an MVFM program, DagQL lets you inspect, rewrite, and transform the AST before running it.</p>
<ul>
  <li><code>selectWhere(nexpr, predicate)</code> finds nodes in the graph.</li>
  <li><code>replaceWhere(nexpr, predicate, newKind)</code> swaps node kinds.</li>
  <li><code>pipe(nexpr, f1, f2, ...)</code> chains transformations.</li>
  <li><code>commit(dirtyExpr)</code> seals the result for execution.</li>
</ul>
<p>The pattern becomes: <strong>app → prog → dagql → fold</strong>.</p>`,
    code: `const app = mvfm(prelude, console_);

// build a program: (x + 10) * 2, then log it
const prog = app({ x: "number" }, ($) => {
  const sum = $.add($.input.x, 10);
  return $.begin(
    $.console.log("result:", $.mul(sum, 2)),
    $.mul(sum, 2)
  );
});

const injected = injectInput(prog, { x: 5 });

// rewrite: swap add → mul, so it becomes (x * 10) * 2
const rewritten = commit(
  replaceWhere(injected.__nexpr, byKind("num/add"), "num/mul")
);

await fold(rewritten, defaults(app));`,
  },

  ...externalIndexes,
};

export { indexes };
