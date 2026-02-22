import type { NamespaceIndex } from "./types";

const indexes: Record<string, NamespaceIndex> = {
  core: {
    content: `<p>MVFM is an extensible <a href="https://okmij.org/ftp/tagless-final/index.html">tagless-final</a> DSL for deterministic TypeScript programs. Every program follows a three-step pattern:</p>
<ul>
  <li><code>mvfm(plugins...)</code> creates an app with the plugins you need.</li>
  <li><code>app(schema, builder)</code> defines a program from a schema and builder function.</li>
  <li><code>fold(interpreter, program)</code> executes the program with a concrete interpreter.</li>
</ul>
<p>MVFM stands for Minimum Viable Free Monad. The eventual goal is to reimplement TypeScript in TypeScript.</p>
`,
    code: `const app = mvfm(prelude, console_);

const prog = app({ greeting: "string" }, ($) =>
  $.console.log($.concat($.input.greeting, " — have fun!"))
);

await fold(
  defaults(app),
  injectInput(prog, { greeting: "hello, mvfm" })
);`,
  },

  bool: {
    content: `<p>Boolean logic operations. Provides typeclass instances that allow boolean values to participate in equality, display, and logical algebra.</p>
<p>Included on the default interpreter.</p>`,
    code: `const app = mvfm(prelude);

const prog = app({ x: "number" }, ($) =>
  $.and(true, $.gt($.input.x, 0))
);

await fold(defaults(app), injectInput(prog, { x: 7 }));`,
  },

  num: {
    content: `<p>Arithmetic and numeric operations. Provides typeclass instances for equality, ordering, and display of numbers.</p>
<p>Included on the default interpreter.</p>`,
    code: `const app = mvfm(prelude);

const prog = app({ x: "number" }, ($) =>
  $.mul($.add($.input.x, 10), 2)
);

await fold(defaults(app), injectInput(prog, { x: 11 }));`,
  },

  str: {
    content: `<p>String manipulation operations. Provides typeclass instances for equality and display of strings.</p>
<p>Included on the default interpreter.</p>`,
    code: `const app = mvfm(prelude);

const prog = app({ first: "string", last: "string" }, ($) =>
  $.upper($.concat($.input.first, " ", $.input.last))
);

await fold(
  defaults(app),
  injectInput(prog, { first: "Jane", last: "Doe" })
);`,
  },

  eq: {
    content: `<p>Equality typeclass. Dispatches equality and inequality checks to type-specific implementations based on the inferred argument types.</p>
<p>Included on the default interpreter.</p>`,
    code: `const app = mvfm(prelude);

const prog = app({ x: "number", y: "number" }, ($) =>
  $.eq($.add($.input.x, 1), $.input.y)
);

await fold(defaults(app), injectInput(prog, { x: 9, y: 10 }));`,
  },

  ord: {
    content: `<p>Ordering typeclass. Dispatches comparison operations to type-specific implementations based on the inferred argument types. Builds on the equality typeclass.</p>
<p>Included on the default interpreter.</p>`,
    code: `const app = mvfm(prelude);

const prog = app({ age: "number" }, ($) =>
  $.cond($.gte($.input.age, 18)).t("allowed").f("denied")
);

await fold(defaults(app), injectInput(prog, { age: 21 }));`,
  },

  st: {
    content: `<p>Mutable local state. Declares variables scoped to a single program execution, with operations for reading and writing their values.</p>
<p>Included on the default interpreter.</p>`,
    code: `const app = mvfm(prelude, st);

const prog = app({ n: "number" }, ($) => {
  const counter = $.let($.input.n);
  counter.set($.mul(counter.get(), 2));
  return counter.get();
});

await fold(defaults(app), injectInput(prog, { n: 21 }));`,
  },

  control: {
    content: `<p>Control flow operations for iteration over collections and conditional looping.</p>
<p>Included on the default interpreter.</p>`,
    code: `const app = mvfm(prelude, st, control);

const prog = app({ x: "number" }, ($) => {
  const sum = $.let(0);
  $.each([$.input.x, 10, 20], (item) => {
    sum.set($.add(sum.get(), item));
  });
  return sum.get();
});

await fold(defaults(app), injectInput(prog, { x: 1 }));`,
  },

  error: {
    content: `<p>Explicit error handling as part of the AST structure. Errors are values that can be caught, recovered from, and accumulated rather than thrown as exceptions.</p>
<p>Included on the default interpreter.</p>`,
    code: `const app = mvfm(prelude, error);

const prog = app({ x: "number" }, ($) => {
  const risky = $.cond($.gt($.input.x, 10))
    .t($.input.x)
    .f($.fail("too small"));
  return $.try(risky).catch((err) =>
    $.concat("recovered: ", err)
  );
});

await fold(defaults(app), injectInput(prog, { x: 3 }));`,
  },

  fiber: {
    content: `<p>Concurrency primitives for parallel execution, racing, timeouts, and retries. Concurrency is opt-in and bounded.</p>
<p>Included on the default interpreter.</p>`,
    code: `const app = mvfm(prelude, fiber);

const prog = app({ x: "number" }, ($) => {
  const fast = $.add($.input.x, 1);
  const slow = $.mul($.input.x, 100);
  return $.race(fast, slow);
});

await fold(defaults(app), injectInput(prog, { x: 5 }));`,
  },

  console: {
    content: `<p>Implementation of the <a href="https://developer.mozilla.org/en-US/docs/Web/API/console">Console API</a>. The interpreter requires a console object to write to.</p>
<p>The playground redirects output using <code>createConsoleInterpreter()</code> so that logs appear inline.</p>`,
    code: `const app = mvfm(prelude, console_);

const prog = app({ name: "string" }, ($) =>
  $.begin(
    $.console.log("hello", $.input.name),
    $.console.warn("this is a warning"),
    42
  )
);

await fold(defaults(app), injectInput(prog, { name: "world" }));`,
  },

  anthropic: {
    content: `<p>Implementation of the <a href="https://docs.anthropic.com/en/api/messages">Anthropic Messages API</a>. There is no default interpreter because this plugin requires API credentials.</p>
<p>Use <code>anthropic({ apiKey })</code> in your app and provide a configured interpreter at runtime.</p>`,
  },

  "cloudflare-kv": {
    content: `<p>Implementation of Cloudflare KV operations. There is no default interpreter because KV requires a configured namespace.</p>
<p>The playground uses an in-memory KV mock to keep examples deterministic and side-effect free.</p>`,
  },

  fal: {
    content: `<p>Implementation of the <a href="https://fal.ai/models">Fal AI API</a>. There is no default interpreter because calls require credentials and network access.</p>
<p>Examples use mocked responses via <code>mockInterpreter</code> so each node kind remains runnable in docs.</p>`,
  },

  fetch: {
    content: `<p>Implementation of the WHATWG Fetch API. The plugin models request/response operations as explicit AST nodes.</p>
<p>Use this for deterministic HTTP interaction patterns, including status/header/body extraction.</p>`,
  },

  openai: {
    content: `<p>Implementation of the <a href="https://platform.openai.com/docs/api-reference">OpenAI API</a>. There is no default interpreter because this plugin requires an API key.</p>
<p>Examples run with mocked interpreters to make output deterministic while preserving realistic call shapes.</p>`,
  },

  pino: {
    content: `<p>Implementation of the <a href="https://github.com/pinojs/pino">Pino logger API</a>. There is no default interpreter because logging targets are application-defined.</p>
<p>The docs playground routes logs to an in-memory sink so you can inspect behavior directly.</p>`,
  },

  postgres: {
    content: `<p>Implementation of <a href="https://github.com/porsager/postgres">postgres.js</a>. There is no default interpreter because it requires a live database connection.</p>
<p>You construct one by calling <code>serverInterpreter(client, baseInterpreter)</code> with a connected client. The playground examples on this site use <code>wasmPgInterpreter</code>, backed by PGLite, an in-browser WASM build of Postgres.</p>`,
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
await fold(
  { ...baseInterp, ...pgInterp },
  injectInput(prog, { userId: 42 })
);`,
  },

  redis: {
    content: `<p>Implementation of Redis command groups (strings, hashes, lists, and keys). There is no default interpreter because Redis requires a client connection.</p>
<p>The docs playground uses an in-memory Redis interpreter so examples remain deterministic.</p>`,
  },

  resend: {
    content: `<p>Implementation of the <a href="https://resend.com/docs/api-reference">Resend API</a>. There is no default interpreter because this plugin requires an API key.</p>
<p>Examples are wired to fixture-backed mocks so request/response behavior is reproducible in the playground.</p>`,
  },

  s3: {
    content: `<p>Implementation of Amazon S3 object operations. There is no default interpreter because this plugin requires configured AWS client access.</p>
<p>Docs examples use an in-memory S3 mock so behavior is deterministic and runnable in-browser.</p>`,
  },

  stripe: {
    content: `<p>Implementation of the <a href="https://docs.stripe.com/api">Stripe API</a>. There is no default interpreter because this plugin requires an API key.</p>
<p>Examples use mocked interpreters to keep all payment node kinds runnable in docs without external side effects.</p>`,
  },

  twilio: {
    content: `<p>Implementation of the <a href="https://www.twilio.com/docs/usage/api">Twilio REST API</a>. There is no default interpreter because this plugin requires account credentials.</p>
<p>The documented node kinds currently cover message and call operations with deterministic mocked execution in the playground.</p>`,
  },

  zod: {
    content: `<p>Implementation of <a href="https://github.com/colinhacks/zod">Zod</a>. Schemas are constructed as AST nodes and reconstructed into real Zod validators at runtime by the interpreter.</p>
<p>Included on the default interpreter.</p>`,
    code: `const app = mvfm(prelude, zod);

const prog = app({ value: "string" }, ($) =>
  $.zod.string().min(3).parse($.input.value)
);

await fold(
  defaults(app),
  injectInput(prog, { value: "hello" })
);`,
  },
};

export default indexes;
