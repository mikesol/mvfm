import type { NodeExample } from "./types";

const ZP = ["@mvfm/plugin-zod"];

/** Zod schema examples: object through xor, plus transform/pipe/preprocess. */
const examples: Record<string, NodeExample> = {
  "zod/object": {
    description: "Schema for validating objects with typed properties",
    code: `const app = mvfm(prelude, zod);
const prog = app({ value: "string" }, ($) => {
  return $.zod.object({ name: $.zod.string() }).partial().parse($.input.value);
});
await foldAST(
  defaults(app),
  injectInput(prog, { value: { name: "Alice" } })
);`,
    plugins: ZP,
  },
  "zod/promise": {
    description: "Schema that wraps another schema in a Promise type",
    code: `// Promise schemas require async parsing at runtime.
// This example builds the AST; use safeParseAsync in a real interpreter.
const app = mvfm(prelude, zod);
const prog = app({ value: "string" }, ($) => {
  return $.zod.promise($.zod.string()).safeParseAsync($.input.value);
});`,
    plugins: ZP,
  },
  "zod/record": {
    description: "Schema for validating record objects with typed keys and values",
    code: `const app = mvfm(prelude, zod);
const prog = app({ value: "string" }, ($) => {
  return $.zod.record($.zod.string(), $.zod.number()).parse($.input.value);
});
await foldAST(
  defaults(app),
  injectInput(prog, { value: { x: 1, y: 2 } })
);`,
    plugins: ZP,
  },
  "zod/set": {
    description: "Schema for validating Set objects with typed elements",
    code: `const app = mvfm(prelude, zod);
const prog = app({ value: "string" }, ($) => {
  return $.zod.set($.zod.string()).parse($.input.value);
});
await foldAST(
  defaults(app),
  injectInput(prog, { value: new Set(["a", "b"]) })
);`,
    plugins: ZP,
  },
  "zod/string": {
    description: "Schema for validating string values with optional checks",
    code: `const app = mvfm(prelude, zod);
const prog = app({ value: "string" }, ($) => {
  return $.zod.string().min(1).max(255).parse($.input.value);
});
await foldAST(
  defaults(app),
  injectInput(prog, { value: "hello world" })
);`,
    plugins: ZP,
  },
  "zod/symbol": {
    description: "Schema that validates symbol values",
    code: `const app = mvfm(prelude, zod);
const prog = app({ value: "string" }, ($) => {
  return $.zod.symbol().safeParse($.input.value);
});
await foldAST(
  defaults(app),
  injectInput(prog, { value: Symbol("test") })
);`,
    plugins: ZP,
  },
  "zod/tuple": {
    description: "Schema for fixed-length arrays with per-element types",
    code: `const app = mvfm(prelude, zod);
const prog = app({ value: "string" }, ($) => {
  return $.zod.tuple([$.zod.string(), $.zod.number()]).parse($.input.value);
});
await foldAST(
  defaults(app),
  injectInput(prog, { value: ["hello", 42] })
);`,
    plugins: ZP,
  },
  "zod/undefined": {
    description: "Schema that only accepts undefined",
    code: `const app = mvfm(prelude, zod);
const prog = app({ value: "string" }, ($) => {
  return $.zod.undefined().safeParse($.input.value);
});
await foldAST(
  defaults(app),
  injectInput(prog, { value: undefined })
);`,
    plugins: ZP,
  },
  "zod/union": {
    description: "Schema for values matching any of several schemas",
    code: `const app = mvfm(prelude, zod);
const prog = app({ value: "string" }, ($) => {
  return $.zod.union([$.zod.string(), $.zod.number()]).parse($.input.value);
});
await foldAST(
  defaults(app),
  injectInput(prog, { value: "hello" })
);`,
    plugins: ZP,
  },
  "zod/discriminated_union": {
    description: "Schema for discriminated unions that use a discriminator key for efficient parsing",
    code: `const app = mvfm(prelude, zod);
const prog = app({ value: "string" }, ($) => {
  return $.zod.discriminatedUnion("status", [
    $.zod.object({ status: $.zod.literal("success"), data: $.zod.string() }),
    $.zod.object({ status: $.zod.literal("failed"), error: $.zod.string() }),
  ]).parse($.input.value);
});
await foldAST(
  defaults(app),
  injectInput(prog, { value: { status: "success", data: "hello" } })
);`,
    plugins: ZP,
  },
  "zod/unknown": {
    description: "Schema that accepts unknown values for later narrowing",
    code: `const app = mvfm(prelude, zod);
const prog = app({ value: "string" }, ($) => {
  return $.zod.unknown().parse($.input.value);
});
await foldAST(
  defaults(app),
  injectInput(prog, { value: "anything" })
);`,
    plugins: ZP,
  },
  "zod/void": {
    description: "Schema that only accepts void/undefined returns",
    code: `const app = mvfm(prelude, zod);
const prog = app({ value: "string" }, ($) => {
  return $.zod.void().safeParse($.input.value);
});
await foldAST(
  defaults(app),
  injectInput(prog, { value: undefined })
);`,
    plugins: ZP,
  },
  "zod/xor": {
    description: "Schema for values matching exactly one of several schemas",
    code: `const app = mvfm(prelude, zod);
const prog = app({ value: "string" }, ($) => {
  return $.zod.xor([$.zod.string(), $.zod.number()]).parse($.input.value);
});
await foldAST(
  defaults(app),
  injectInput(prog, { value: "hello" })
);`,
    plugins: ZP,
  },
  "zod/transform": {
    description: "Standalone transform that maps parsed values through a function",
    code: `const app = mvfm(prelude, zod);
const prog = app({ value: "string" }, ($) => {
  return $.zod.transform((val) => val).parse($.input.value);
});
await foldAST(
  defaults(app),
  injectInput(prog, { value: "hello" })
);`,
    plugins: ZP,
  },
  "zod/pipe": {
    description: "Chain one schema into another for multi-step validation",
    code: `const app = mvfm(prelude, zod);
const prog = app({ value: "string" }, ($) => {
  return $.zod.string().pipe($.zod.string()).parse($.input.value);
});
await foldAST(
  defaults(app),
  injectInput(prog, { value: "hello" })
);`,
    plugins: ZP,
  },
  "zod/preprocess": {
    description: "Apply a preprocessing step to input before schema validation",
    code: `const app = mvfm(prelude, zod);
const prog = app({ value: "string" }, ($) => {
  return $.zod.preprocess((val) => val, $.zod.string()).parse($.input.value);
});
await foldAST(
  defaults(app),
  injectInput(prog, { value: "hello" })
);`,
    plugins: ZP,
  },
};

export default examples;
