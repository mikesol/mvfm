import type { NodeExample } from "./types";

const ZP = ["@mvfm/plugin-zod"];

const examples: Record<string, NodeExample> = {
  "zod/branded": {
    description: "Brand a schema to create a nominal type tag",
    code: `const app = mvfm(prelude, console_, zod);
const prog = app({ value: "string" }, ($) => {
  const result = $.zod.string().brand("Email").parse($.input.value);
  return $.begin($.console.log(result), result);
});
await foldAST(
  defaults(app, { zod: createZodInterpreter() }),
  injectInput(prog, { value: "user@example.com" })
);`,
    plugins: ZP,
  },
  "zod/catch": {
    description: "Provide a fallback value when validation fails",
    code: `const app = mvfm(prelude, console_, zod);
const prog = app({ value: "string" }, ($) => {
  const result = $.zod.string().catch("default").parse($.input.value);
  return $.begin($.console.log(result), result);
});
await foldAST(
  defaults(app, { zod: createZodInterpreter() }),
  injectInput(prog, { value: "hello" })
);`,
    plugins: ZP,
  },
  "zod/default": {
    description: "Supply a default value for undefined inputs",
    code: `const app = mvfm(prelude, console_, zod);
const prog = app({ value: "string" }, ($) => {
  const result = $.zod.string().default("hello").parse($.input.value);
  return $.begin($.console.log(result), result);
});
await foldAST(
  defaults(app, { zod: createZodInterpreter() }),
  injectInput(prog, { value: undefined })
);`,
    plugins: ZP,
  },
  "zod/nonoptional": {
    description: "Remove optionality from a schema, requiring a value",
    code: `const app = mvfm(prelude, console_, zod);
const prog = app({ value: "string" }, ($) => {
  const result = $.zod.string().optional().nonoptional().parse($.input.value);
  return $.begin($.console.log(result), result);
});
await foldAST(
  defaults(app, { zod: createZodInterpreter() }),
  injectInput(prog, { value: "required" })
);`,
    plugins: ZP,
  },
  "zod/nullable": {
    description: "Allow null in addition to the base type",
    code: `const app = mvfm(prelude, console_, zod);
const prog = app({ value: "string" }, ($) => {
  const result = $.zod.string().nullable().parse($.input.value);
  return $.begin($.console.log(result), result);
});
await foldAST(
  defaults(app, { zod: createZodInterpreter() }),
  injectInput(prog, { value: "hello" })
);`,
    plugins: ZP,
  },
  "zod/nullish": {
    description: "Allow both null and undefined in addition to the base type",
    code: `const app = mvfm(prelude, console_, zod);
const prog = app({ value: "string" }, ($) => {
  const result = $.zod.string().nullish().parse($.input.value);
  return $.begin($.console.log(result), result);
});
await foldAST(
  defaults(app, { zod: createZodInterpreter() }),
  injectInput(prog, { value: "hello" })
);`,
    plugins: ZP,
  },
  "zod/optional": {
    description: "Mark a schema as optional, allowing undefined",
    code: `const app = mvfm(prelude, console_, zod);
const prog = app({ value: "string" }, ($) => {
  const result = $.zod.string().optional().parse($.input.value);
  return $.begin($.console.log(result), result);
});
await foldAST(
  defaults(app, { zod: createZodInterpreter() }),
  injectInput(prog, { value: "hello" })
);`,
    plugins: ZP,
  },
  "zod/parse": {
    description: "Parse input and throw on validation failure",
    code: `const app = mvfm(prelude, console_, zod);
const prog = app({ value: "string" }, ($) => {
  const result = $.zod.string().parse($.input.value);
  return $.begin($.console.log(result), result);
});
await foldAST(
  defaults(app, { zod: createZodInterpreter() }),
  injectInput(prog, { value: "hello" })
);`,
    plugins: ZP,
  },
  "zod/parse_async": {
    description: "Parse input asynchronously and throw on validation failure",
    code: `const app = mvfm(prelude, console_, zod);
const prog = app({ value: "string" }, ($) => {
  const result = $.zod.string().parseAsync($.input.value);
  return $.begin($.console.log(result), result);
});
await foldAST(
  defaults(app, { zod: createZodInterpreter() }),
  injectInput(prog, { value: "hello" })
);`,
    plugins: ZP,
  },
  "zod/prefault": {
    description: "Supply a default before validation rather than after",
    code: `const app = mvfm(prelude, console_, zod);
const prog = app({ value: "string" }, ($) => {
  const result = $.zod.string().min(1).prefault("fallback").parse($.input.value);
  return $.begin($.console.log(result), result);
});
await foldAST(
  defaults(app, { zod: createZodInterpreter() }),
  injectInput(prog, { value: undefined })
);`,
    plugins: ZP,
  },
  "zod/readonly": {
    description: "Mark a schema output as readonly",
    code: `const app = mvfm(prelude, console_, zod);
const prog = app({ value: "string" }, ($) => {
  const result = $.zod.object({ name: $.zod.string() }).readonly().parse($.input.value);
  return $.begin($.console.log(result), result);
});
await foldAST(
  defaults(app, { zod: createZodInterpreter() }),
  injectInput(prog, { value: { name: "Alice" } })
);`,
    plugins: ZP,
  },
  "zod/safe_parse": {
    description: "Parse input returning a result object instead of throwing",
    code: `const app = mvfm(prelude, console_, zod);
const prog = app({ value: "string" }, ($) => {
  const result = $.zod.string().safeParse($.input.value);
  return $.begin($.console.log(result), result);
});
await foldAST(
  defaults(app, { zod: createZodInterpreter() }),
  injectInput(prog, { value: "hello" })
);`,
    plugins: ZP,
  },
  "zod/safe_parse_async": {
    description: "Parse input asynchronously returning a result object",
    code: `const app = mvfm(prelude, console_, zod);
const prog = app({ value: "string" }, ($) => {
  const result = $.zod.string().safeParseAsync($.input.value);
  return $.begin($.console.log(result), result);
});
await foldAST(
  defaults(app, { zod: createZodInterpreter() }),
  injectInput(prog, { value: "hello" })
);`,
    plugins: ZP,
  },
};

export default examples;
