import type { NamespaceIndex } from "./types";

const indexes: Record<string, NamespaceIndex> = {
  core: {
    content: `<p>MVFM is an extensible tagless-final DSL for deterministic TypeScript programs. Every program follows a three-step pattern:</p>
<ul>
  <li><code>mvfm(plugins...)</code> creates an app with the plugins you need.</li>
  <li><code>app(schema, builder)</code> defines a program from a schema and builder function.</li>
  <li><code>foldAST(interpreter, program)</code> executes the program with a concrete interpreter.</li>
</ul>
<p>The <code>prelude</code> export bundles all core plugins. Use <code>defaults(app)</code> to build a standard interpreter, and <code>injectInput(prog, data)</code> to provide runtime values.</p>`,
  },

  boolean: {
    content: `<p>Boolean logic operations: <code>and</code>, <code>or</code>, <code>not</code>, <code>implies</code>.</p>
<p>Provides typeclass instances for <code>eq</code>, <code>show</code>, and <code>heytingAlgebra</code>. Users typically access boolean ops through typeclass dispatch rather than directly. Pure logic &mdash; <code>defaults()</code> just works.</p>`,
  },

  num: {
    content: `<p>Arithmetic and numeric operations: <code>sub</code>, <code>div</code>, <code>mod</code>, <code>neg</code>, <code>abs</code>, <code>floor</code>, <code>ceil</code>, <code>round</code>, <code>min</code>, <code>max</code>.</p>
<p>Also provides typeclass instances for <code>eq</code>, <code>ord</code>, and <code>show</code>. Pure logic &mdash; <code>defaults()</code> just works.</p>`,
  },

  str: {
    content: `<p>String manipulation: template literals via <code>str</code>, plus <code>concat</code>, <code>upper</code>, <code>lower</code>, <code>trim</code>, <code>slice</code>, <code>includes</code>, <code>startsWith</code>, <code>endsWith</code>, <code>split</code>, <code>join</code>, <code>replace</code>, <code>len</code>.</p>
<p>Provides <code>eq</code> and <code>show</code> instances. Pure logic &mdash; <code>defaults()</code> just works.</p>`,
  },

  eq: {
    content: `<p>Equality typeclass: <code>eq(a, b)</code> and <code>neq(a, b)</code>.</p>
<p>Dispatches to type-specific implementations based on argument types. Pure logic &mdash; <code>defaults()</code> just works.</p>`,
  },

  ord: {
    content: `<p>Ordering typeclass: <code>gt</code>, <code>gte</code>, <code>lt</code>, <code>lte</code>, <code>compare</code>.</p>
<p>Dispatches based on argument types. Builds on <code>eq</code>. Pure logic &mdash; <code>defaults()</code> just works.</p>`,
  },

  st: {
    content: `<p>Mutable local state: <code>$.let(initial)</code> declares a variable with <code>.get()</code>, <code>.set()</code>, <code>.push()</code>.</p>
<p>Variables are scoped to program execution. Interpreter included in <code>defaults()</code>.</p>`,
  },

  control: {
    content: `<p>Control flow: <code>$.each(collection, fn)</code> for iteration, <code>$.while(cond).body(fn)</code> for loops.</p>
<p>Interpreter included in <code>defaults()</code>.</p>`,
  },

  error: {
    content: `<p>Explicit error handling: <code>$.try(expr).catch(fn)</code>, <code>$.fail(msg)</code>, <code>$.attempt(expr)</code>, <code>$.guard(cond, msg)</code>, <code>$.settle(...exprs)</code>.</p>
<p>Interpreter included in <code>defaults()</code>.</p>`,
  },

  fiber: {
    content: `<p>Concurrency primitives: <code>$.par(a, b, c)</code> for parallel execution, <code>$.race(a, b)</code> for first-to-complete, <code>$.timeout(expr, ms, fallback)</code>, <code>$.retry(expr, opts)</code>.</p>
<p>Concurrency is opt-in and bounded. Interpreter included in <code>defaults()</code>.</p>`,
  },

  console: {
    content: `<p>Console output mirroring the Node.js console API: <code>$.console.log()</code>, <code>$.console.warn()</code>, etc.</p>
<p>External plugin (<code>@mvfm/plugin-console</code>). Has a default interpreter. The playground uses <code>createConsoleInterpreter()</code> to redirect output.</p>`,
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
  },
};

export default indexes;
