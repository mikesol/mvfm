import type { NodeExample } from "./types";

const ZP = ["@mvfm/plugin-zod"];

const examples: Record<string, NodeExample> = {
  "zod/branded": {
    description: "Brand a schema to create a nominal type tag",
    code: `const app = mvfm(prelude, zod);
const prog = app({ value: "string" }, ($) => {
  return $.zod.string().brand("Email").parse($.input.value);
});
await fold(
  defaults(app),
  injectInput(prog, { value: "user@example.com" })
);`,
    plugins: ZP,
  },
  "zod/catch": {
    description: "Provide a fallback value when validation fails",
    code: `const app = mvfm(prelude, zod);
const prog = app({ value: "string" }, ($) => {
  return $.zod.string().catch("default").parse($.input.value);
});
await fold(
  defaults(app),
  injectInput(prog, { value: "hello" })
);`,
    plugins: ZP,
  },
  "zod/default": {
    description: "Supply a default value for undefined inputs",
    code: `const app = mvfm(prelude, zod);
const prog = app({ value: "string" }, ($) => {
  return $.zod.string().default("hello").parse($.input.value);
});
await fold(
  defaults(app),
  injectInput(prog, { value: undefined })
);`,
    plugins: ZP,
  },
  "zod/nonoptional": {
    description: "Remove optionality from a schema, requiring a value",
    code: `const app = mvfm(prelude, zod);
const prog = app({ value: "string" }, ($) => {
  return $.zod.string().optional().nonoptional().parse($.input.value);
});
await fold(
  defaults(app),
  injectInput(prog, { value: "required" })
);`,
    plugins: ZP,
  },
  "zod/nullable": {
    description: "Allow null in addition to the base type",
    code: `const app = mvfm(prelude, zod);
const prog = app({ value: "string" }, ($) => {
  return $.zod.string().nullable().parse($.input.value);
});
await fold(
  defaults(app),
  injectInput(prog, { value: "hello" })
);`,
    plugins: ZP,
  },
  "zod/nullish": {
    description: "Allow both null and undefined in addition to the base type",
    code: `const app = mvfm(prelude, zod);
const prog = app({ value: "string" }, ($) => {
  return $.zod.string().nullish().parse($.input.value);
});
await fold(
  defaults(app),
  injectInput(prog, { value: "hello" })
);`,
    plugins: ZP,
  },
  "zod/optional": {
    description: "Mark a schema as optional, allowing undefined",
    code: `const app = mvfm(prelude, zod);
const prog = app({ value: "string" }, ($) => {
  return $.zod.string().optional().parse($.input.value);
});
await fold(
  defaults(app),
  injectInput(prog, { value: "hello" })
);`,
    plugins: ZP,
  },
  "zod/parse": {
    description: "Parse input and throw on validation failure",
    code: `const app = mvfm(prelude, zod);
const prog = app({ value: "string" }, ($) => {
  return $.zod.string().parse($.input.value);
});
await fold(
  defaults(app),
  injectInput(prog, { value: "hello" })
);`,
    plugins: ZP,
  },
  "zod/parse_async": {
    description: "Parse input asynchronously and throw on validation failure",
    code: `const app = mvfm(prelude, zod);
const prog = app({ value: "string" }, ($) => {
  return $.zod.string().parseAsync($.input.value);
});
await fold(
  defaults(app),
  injectInput(prog, { value: "hello" })
);`,
    plugins: ZP,
  },
  "zod/prefault": {
    description: "Supply a default before validation rather than after",
    code: `const app = mvfm(prelude, zod);
const prog = app({ value: "string" }, ($) => {
  return $.zod.string().min(1).prefault("fallback").parse($.input.value);
});
await fold(
  defaults(app),
  injectInput(prog, { value: undefined })
);`,
    plugins: ZP,
  },
  "zod/readonly": {
    description: "Mark a schema output as readonly",
    code: `const app = mvfm(prelude, zod);
const prog = app({ value: "string" }, ($) => {
  return $.zod.object({ name: $.zod.string() }).readonly().parse($.input.value);
});
await fold(
  defaults(app),
  injectInput(prog, { value: { name: "Alice" } })
);`,
    plugins: ZP,
  },
  "zod/safe_parse": {
    description: "Parse input returning a result object instead of throwing",
    code: `const app = mvfm(prelude, zod);
const prog = app({ value: "string" }, ($) => {
  return $.zod.string().safeParse($.input.value);
});
await fold(
  defaults(app),
  injectInput(prog, { value: "hello" })
);`,
    plugins: ZP,
  },
  "zod/safe_parse_async": {
    description: "Parse input asynchronously returning a result object",
    code: `const app = mvfm(prelude, zod);
const prog = app({ value: "string" }, ($) => {
  return $.zod.string().safeParseAsync($.input.value);
});
await fold(
  defaults(app),
  injectInput(prog, { value: "hello" })
);`,
    plugins: ZP,
  },
  "zod/from": {
    description: "Import a runtime Zod schema into the mvfm zod namespace",
    code: `const userSchema = z.object({
  name: z.string().min(2),
  age: z.number().int().gte(18),
});
const app = mvfm(prelude, zod);
const prog = app(($) => {
  return $.zod.from(userSchema).safeParse($.input);
});
await fold(
  defaults(app),
  injectInput(prog, { name: "Ada", age: 21 })
);`,
    plugins: ZP,
  },
};

export default examples;
