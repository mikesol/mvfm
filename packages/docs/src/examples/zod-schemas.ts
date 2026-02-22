import type { NodeExample } from "./types";

const ZP = ["@mvfm/plugin-zod"];

/** Zod schema examples: any through number (alphabetical first half). */
const examples: Record<string, NodeExample> = {
  "zod/any": {
    description: "Schema that accepts any value without validation",
    code: `const app = mvfm(prelude, zod);
const prog = app({ value: "string" }, ($) => {
  return $.zod.any().parse($.input.value);
});
await fold(
  defaults(app),
  injectInput(prog, { value: "anything" })
);`,
    plugins: ZP,
  },
  "zod/array": {
    description: "Schema for validating arrays with element type and length constraints",
    code: `const app = mvfm(prelude, zod);
const prog = app({ value: "string" }, ($) => {
  return $.zod.array($.zod.string()).min(1).max(10).parse($.input.value);
});
await fold(
  defaults(app),
  injectInput(prog, { value: ["a", "b", "c"] })
);`,
    plugins: ZP,
  },
  "zod/bigint": {
    description: "Schema for validating bigint values with range constraints",
    code: `const app = mvfm(prelude, zod);
const prog = app({ value: "string" }, ($) => {
  return $.zod.bigint().positive().parse($.input.value);
});
await fold(
  defaults(app),
  injectInput(prog, { value: 42n })
);`,
    plugins: ZP,
  },
  "zod/boolean": {
    description: "Schema for validating boolean values",
    code: `const app = mvfm(prelude, zod);
const prog = app({ value: "string" }, ($) => {
  return $.zod.boolean().parse($.input.value);
});
await fold(
  defaults(app),
  injectInput(prog, { value: true })
);`,
    plugins: ZP,
  },
  "zod/custom": {
    description: "Schema with a custom validation function",
    code: `const app = mvfm(prelude, zod);
const prog = app({ value: "number" }, ($) => {
  return $.zod.custom((val) => $.gt(val, 0)).parse($.input.value);
});
await fold(
  defaults(app),
  injectInput(prog, { value: 5 })
);`,
    plugins: ZP,
  },
  "zod/date": {
    description: "Schema for validating Date objects with range constraints",
    code: `const app = mvfm(prelude, zod);
const prog = app({ value: "string" }, ($) => {
  return $.zod.date().safeParse($.input.value);
});
await fold(
  defaults(app),
  injectInput(prog, { value: new Date() })
);`,
    plugins: ZP,
  },
  "zod/enum": {
    description: "Schema for a fixed set of allowed string values",
    code: `const app = mvfm(prelude, zod);
const prog = app({ value: "string" }, ($) => {
  return $.zod.enum(["red", "green", "blue"]).parse($.input.value);
});
await fold(
  defaults(app),
  injectInput(prog, { value: "green" })
);`,
    plugins: ZP,
  },
  "zod/intersection": {
    description: "Schema combining two schemas with logical AND",
    code: `const app = mvfm(prelude, zod);
const prog = app({ value: "string" }, ($) => {
  return $.zod.intersection(
    $.zod.object({ name: $.zod.string() }),
    $.zod.object({ age: $.zod.number() }),
  ).parse($.input.value);
});
await fold(
  defaults(app),
  injectInput(prog, { value: { name: "Alice", age: 30 } })
);`,
    plugins: ZP,
  },
  "zod/lazy": {
    description: "Schema for self-referential and mutually recursive data structures",
    code: `const app = mvfm(prelude, zod);
const prog = app({ value: "object" }, ($) => {
  const Category = $.zod.object({
    name: $.zod.string(),
    subcategories: $.zod.lazy(() => $.zod.array(Category)),
  });
  return Category.parse($.input.value);
});
await fold(
  defaults(app),
  injectInput(prog, { 
    value: { 
      name: "Electronics", 
      subcategories: [
        { name: "Laptops", subcategories: [] }
      ]
    }
  })
);`,
    plugins: ZP,
  },
  "zod/lazy_ref": {
    description:
      "Internal back-reference emitted inside recursive lazy schemas to keep the AST finite",
    code: `const app = mvfm(prelude, zod);
const prog = app({ value: "object" }, ($) => {
  const Category = $.zod.object({
    name: $.zod.string(),
    subcategories: $.zod.lazy(() => $.zod.array(Category)),
  });
  return Category.parse($.input.value);
});
await fold(
  defaults(app),
  injectInput(prog, {
    value: {
      name: "Root",
      subcategories: [{ name: "Leaf", subcategories: [] }],
    },
  })
);`,
    plugins: ZP,
  },
  "zod/literal": {
    description: "Schema for an exact literal value",
    code: `const app = mvfm(prelude, zod);
const prog = app({ value: "string" }, ($) => {
  return $.zod.literal("hello").parse($.input.value);
});
await fold(
  defaults(app),
  injectInput(prog, { value: "hello" })
);`,
    plugins: ZP,
  },
  "zod/map": {
    description: "Schema for validating Map objects with typed keys and values",
    code: `const app = mvfm(prelude, zod);
const prog = app({ value: "string" }, ($) => {
  return $.zod.map($.zod.string(), $.zod.number()).parse($.input.value);
});
await fold(
  defaults(app),
  injectInput(prog, { value: new Map([["a", 1]]) })
);`,
    plugins: ZP,
  },
  "zod/nan": {
    description: "Schema that only accepts NaN",
    code: `const app = mvfm(prelude, zod);
const prog = app({ value: "string" }, ($) => {
  return $.zod.nan().parse($.input.value);
});
await fold(
  defaults(app),
  injectInput(prog, { value: NaN })
);`,
    plugins: ZP,
  },
  "zod/native_enum": {
    description: "Schema for a TypeScript native enum or const object",
    code: `const app = mvfm(prelude, zod);
const prog = app({ value: "number" }, ($) => {
  return $.zod.nativeEnum({ Up: 0, Down: 1 }).parse($.input.value);
});
await fold(
  defaults(app),
  injectInput(prog, { value: 0 })
);`,
    plugins: ZP,
  },
  "zod/never": {
    description: "Schema that rejects all values",
    code: `const app = mvfm(prelude, zod);
const prog = app({ value: "string" }, ($) => {
  return $.zod.never().safeParse($.input.value);
});
await fold(
  defaults(app),
  injectInput(prog, { value: "anything" })
);`,
    plugins: ZP,
  },
  "zod/null": {
    description: "Schema that only accepts null",
    code: `const app = mvfm(prelude, zod);
const prog = app({ value: "string" }, ($) => {
  return $.zod.null().safeParse($.input.value);
});
await fold(
  defaults(app),
  injectInput(prog, { value: null })
);`,
    plugins: ZP,
  },
  "zod/number": {
    description: "Schema for validating numbers with range and type constraints",
    code: `const app = mvfm(prelude, zod);
const prog = app({ value: "number" }, ($) => {
  return $.zod.number().min(0).max(100).int().parse($.input.value);
});
await fold(
  defaults(app),
  injectInput(prog, { value: 42 })
);`,
    plugins: ZP,
  },
};

export default examples;
