import type { NamespaceIndex } from "./types";

const indexes: Record<string, NamespaceIndex> = {
  core: {
    content: `<p>MVFM is an extensible <a href="https://okmij.org/ftp/tagless-final/index.html">tagless-final</a> DSL for deterministic TypeScript programs. Every program follows a three-step pattern:</p>
<ul>
  <li><code>mvfm(plugins...)</code> creates an app with the plugins you need.</li>
  <li><code>app(schema, builder)</code> defines a program from a schema and builder function.</li>
  <li><code>foldAST(interpreter, program)</code> executes the program with a concrete interpreter.</li>
</ul>
<p>MVFM stands for Minimum Viable Free Monad. The eventual goal is to reimplement TypeScript in TypeScript.</p>
`,
    code: `const app = mvfm(prelude, console_);

const prog = app({ greeting: "string" }, ($) =>
  $.console.log($.concat($.input.greeting, " — have fun!"))
);

await foldAST(
  defaults(app),
  injectInput(prog, { greeting: "hello, mvfm" })
);`,
  },

  boolean: {
    content: `<p>Boolean logic operations: <code>and</code>, <code>or</code>, <code>not</code>, <code>implies</code>.</p>
<p>Provides typeclass instances for <code>eq</code>, <code>show</code>, and <code>heytingAlgebra</code>. Users typically access boolean ops through typeclass dispatch rather than directly. Pure logic &mdash; <code>defaults()</code> just works.</p>`,
    code: `const app = mvfm(prelude);

const prog = app({ x: "number" }, ($) =>
  $.and(true, $.gt($.input.x, 0))
);

await foldAST(defaults(app), injectInput(prog, { x: 7 }));`,
  },

  num: {
    content: `<p>Arithmetic and numeric operations: <code>sub</code>, <code>div</code>, <code>mod</code>, <code>neg</code>, <code>abs</code>, <code>floor</code>, <code>ceil</code>, <code>round</code>, <code>min</code>, <code>max</code>.</p>
<p>Also provides typeclass instances for <code>eq</code>, <code>ord</code>, and <code>show</code>. Pure logic &mdash; <code>defaults()</code> just works.</p>`,
    code: `const app = mvfm(prelude);

const prog = app({ x: "number" }, ($) =>
  $.mul($.add($.input.x, 10), 2)
);

await foldAST(defaults(app), injectInput(prog, { x: 11 }));`,
  },

  str: {
    content: `<p>String manipulation: template literals via <code>str</code>, plus <code>concat</code>, <code>upper</code>, <code>lower</code>, <code>trim</code>, <code>slice</code>, <code>includes</code>, <code>startsWith</code>, <code>endsWith</code>, <code>split</code>, <code>join</code>, <code>replace</code>, <code>len</code>.</p>
<p>Provides <code>eq</code> and <code>show</code> instances. Pure logic &mdash; <code>defaults()</code> just works.</p>`,
    code: `const app = mvfm(prelude);

const prog = app({ first: "string", last: "string" }, ($) =>
  $.upper($.concat($.input.first, " ", $.input.last))
);

await foldAST(
  defaults(app),
  injectInput(prog, { first: "Jane", last: "Doe" })
);`,
  },

  eq: {
    content: `<p>Equality typeclass: <code>eq(a, b)</code> and <code>neq(a, b)</code>.</p>
<p>Dispatches to type-specific implementations based on argument types. Pure logic &mdash; <code>defaults()</code> just works.</p>`,
    code: `const app = mvfm(prelude);

const prog = app({ x: "number", y: "number" }, ($) =>
  $.eq($.add($.input.x, 1), $.input.y)
);

await foldAST(defaults(app), injectInput(prog, { x: 9, y: 10 }));`,
  },

  ord: {
    content: `<p>Ordering typeclass: <code>gt</code>, <code>gte</code>, <code>lt</code>, <code>lte</code>, <code>compare</code>.</p>
<p>Dispatches based on argument types. Builds on <code>eq</code>. Pure logic &mdash; <code>defaults()</code> just works.</p>`,
    code: `const app = mvfm(prelude);

const prog = app({ age: "number" }, ($) =>
  $.cond($.gte($.input.age, 18)).t("allowed").f("denied")
);

await foldAST(defaults(app), injectInput(prog, { age: 21 }));`,
  },

  st: {
    content: `<p>Mutable local state: <code>$.let(initial)</code> declares a variable with <code>.get()</code>, <code>.set()</code>, <code>.push()</code>.</p>
<p>Variables are scoped to program execution. Interpreter included in <code>defaults()</code>.</p>`,
    code: `const app = mvfm(prelude);

const prog = app({ n: "number" }, ($) => {
  const counter = $.let($.input.n);
  counter.set($.mul(counter.get(), 2));
  return counter.get();
});

await foldAST(defaults(app), injectInput(prog, { n: 21 }));`,
  },

  control: {
    content: `<p>Control flow: <code>$.each(collection, fn)</code> for iteration, <code>$.while(cond).body(fn)</code> for loops.</p>
<p>Interpreter included in <code>defaults()</code>.</p>`,
    code: `const app = mvfm(prelude, console_);

const prog = app({ x: "number" }, ($) => {
  const sum = $.let(0);
  $.each([$.input.x, 10, 20], (item) => {
    sum.set($.add(sum.get(), item));
  });
  return sum.get();
});

await foldAST(defaults(app), injectInput(prog, { x: 1 }));`,
  },

  error: {
    content: `<p>Explicit error handling: <code>$.try(expr).catch(fn)</code>, <code>$.fail(msg)</code>, <code>$.attempt(expr)</code>, <code>$.guard(cond, msg)</code>, <code>$.settle(...exprs)</code>.</p>
<p>Interpreter included in <code>defaults()</code>.</p>`,
    code: `const app = mvfm(prelude);

const prog = app({ x: "number" }, ($) => {
  const risky = $.cond($.gt($.input.x, 10))
    .t($.input.x)
    .f($.fail("too small"));
  return $.try(risky).catch((err) =>
    $.concat("recovered: ", err)
  );
});

await foldAST(defaults(app), injectInput(prog, { x: 3 }));`,
  },

  fiber: {
    content: `<p>Concurrency primitives: <code>$.par(a, b, c)</code> for parallel execution, <code>$.race(a, b)</code> for first-to-complete, <code>$.timeout(expr, ms, fallback)</code>, <code>$.retry(expr, opts)</code>.</p>
<p>Concurrency is opt-in and bounded. Interpreter included in <code>defaults()</code>.</p>`,
    code: `const app = mvfm(prelude);

const prog = app({ x: "number" }, ($) => {
  const fast = $.add($.input.x, 1);
  const slow = $.mul($.input.x, 100);
  return $.race(fast, slow);
});

await foldAST(defaults(app), injectInput(prog, { x: 5 }));`,
  },

  console: {
    content: `<p>Console output mirroring the Node.js console API: <code>$.console.log()</code>, <code>$.console.warn()</code>, etc.</p>
<p>External plugin (<code>@mvfm/plugin-console</code>). Has a default interpreter. The playground uses <code>createConsoleInterpreter()</code> to redirect output.</p>`,
    code: `const app = mvfm(prelude, console_);

const prog = app({ name: "string" }, ($) =>
  $.begin(
    $.console.log("hello", $.input.name),
    $.console.warn("this is a warning"),
    42
  )
);

await foldAST(defaults(app), injectInput(prog, { name: "world" }));`,
  },

  postgres: {
    content: `<p>Postgres has no <code>defaultInterpreter</code> because it needs a real database connection. You build one with <code>serverInterpreter(client, baseInterpreter)</code>.</p>
<p>Playground examples use <code>wasmPgInterpreter</code> backed by PGLite (in-browser WASM Postgres) as a toy environment.</p>`,
    staticCode: `import { postgres, serverInterpreter, wrapPostgresJs } from "@mvfm/plugin-postgres";
import postgresJs from "postgres";

// 1. Create a postgres.js client
const sql = postgresJs("postgres://user:pass@localhost:5432/mydb");
const client = wrapPostgresJs(sql);

// 2. Build a base interpreter for sub-expressions
const baseInterp = defaults(app);

// 3. Create the postgres interpreter
const pgInterp = serverInterpreter(client, baseInterp);

// 4. Merge and run
await foldAST(
  { ...baseInterp, ...pgInterp },
  injectInput(prog, { userId: 42 })
);`,
  },

  zod: {
    content: `<p>Schema validation as AST nodes: <code>$.zod.string()</code>, <code>$.zod.number()</code>, <code>$.zod.object({...})</code>, <code>$.zod.array(schema)</code>, etc. Parse with <code>.parse(value)</code> and <code>.safeParse(value)</code>.</p>
<p>External plugin (<code>@mvfm/plugin-zod</code>). Needs <code>createZodInterpreter()</code> passed to <code>defaults()</code>.</p>`,
    code: `const app = mvfm(prelude, zod);

const prog = app({ value: "string" }, ($) =>
  $.zod.string().min(3).parse($.input.value)
);

await foldAST(
  defaults(app, { zod: createZodInterpreter() }),
  injectInput(prog, { value: "hello" })
);`,
  },
};

export default indexes;
