import type { NodeExample } from "./types";

const examples: Record<string, NodeExample> = {
  "str/template": {
    description: "Tagged template literal for string interpolation",
    code: `const app = mvfm(prelude);
const prog = app({ name: "string", age: "number" }, ($) => {
  return $.str\`Hello \${$.input.name}, age \${$.input.age}\`;
});
await fold(defaults(app), injectInput(prog, { name: "Alice", age: 30 }));`,
  },
  "str/concat": {
    description: "Concatenate multiple string values into one",
    code: `const app = mvfm(prelude);
const prog = app({ first: "string", last: "string" }, ($) => {
  return $.concat($.input.first, " ", $.input.last);
});
await fold(
  defaults(app),
  injectInput(prog, { first: "Jane", last: "Doe" })
);`,
  },
  "str/upper": {
    description: "Convert a string to uppercase",
    code: `const app = mvfm(prelude);
const prog = app({ s: "string" }, ($) => {
  return $.upper($.input.s);
});
await fold(defaults(app), injectInput(prog, { s: "hello world" }));`,
  },
  "str/lower": {
    description: "Convert a string to lowercase",
    code: `const app = mvfm(prelude);
const prog = app({ s: "string" }, ($) => {
  return $.lower($.input.s);
});
await fold(defaults(app), injectInput(prog, { s: "HELLO WORLD" }));`,
  },
  "str/trim": {
    description: "Remove leading and trailing whitespace from a string",
    code: `const app = mvfm(prelude);
const prog = app({ s: "string" }, ($) => {
  return $.trim($.input.s);
});
await fold(defaults(app), injectInput(prog, { s: "  padded  " }));`,
  },
  "str/slice": {
    description: "Extract a substring by start and optional end index",
    code: `const app = mvfm(prelude);
const prog = app({ s: "string" }, ($) => {
  return $.slice($.input.s, 0, 5);
});
await fold(defaults(app), injectInput(prog, { s: "hello world" }));`,
  },
  "str/includes": {
    description: "Test whether a string contains a given substring",
    code: `const app = mvfm(prelude);
const prog = app({ s: "string" }, ($) => {
  return $.includes($.input.s, "world");
});
await fold(defaults(app), injectInput(prog, { s: "hello world" }));`,
  },
  "str/startsWith": {
    description: "Test whether a string starts with a given prefix",
    code: `const app = mvfm(prelude);
const prog = app({ s: "string" }, ($) => {
  return $.startsWith($.input.s, "http");
});
await fold(defaults(app), injectInput(prog, { s: "https://example.com" }));`,
  },
  "str/endsWith": {
    description: "Test whether a string ends with a given suffix",
    code: `const app = mvfm(prelude);
const prog = app({ s: "string" }, ($) => {
  return $.endsWith($.input.s, ".ts");
});
await fold(defaults(app), injectInput(prog, { s: "index.ts" }));`,
  },
  "str/split": {
    description: "Split a string by a delimiter into an array",
    code: `const app = mvfm(prelude);
const prog = app({ csv: "string" }, ($) => {
  return $.split($.input.csv, ",");
});
await fold(defaults(app), injectInput(prog, { csv: "a,b,c" }));`,
  },
  "str/join": {
    description: "Join an array of strings with a separator",
    code: `const app = mvfm(prelude);
const prog = app({ csv: "string" }, ($) => {
  const parts = $.split($.input.csv, ",");
  return $.join(parts, " | ");
});
await fold(defaults(app), injectInput(prog, { csv: "x,y,z" }));`,
  },
  "str/replace": {
    description: "Replace the first occurrence of a search string",
    code: `const app = mvfm(prelude);
const prog = app({ s: "string" }, ($) => {
  return $.replace($.input.s, "world", "MVFM");
});
await fold(defaults(app), injectInput(prog, { s: "hello world" }));`,
  },
  "str/len": {
    description: "Get the length of a string",
    code: `const app = mvfm(prelude);
const prog = app({ s: "string" }, ($) => {
  return $.len($.input.s);
});
await fold(defaults(app), injectInput(prog, { s: "hello" }));`,
  },
  "str/eq": {
    description: "String equality — compares two strings via the eq typeclass",
    code: `const app = mvfm(prelude);
const prog = app({ a: "string", b: "string" }, ($) => {
  return $.eq($.input.a, $.input.b);
});
await fold(defaults(app), injectInput(prog, { a: "hi", b: "hi" }));`,
  },
  "str/neq": {
    description: "String inequality — true when two strings differ",
    code: `const app = mvfm(prelude);
const prog = app({ a: "string", b: "string" }, ($) => {
  return $.neq($.input.a, $.input.b);
});
await fold(defaults(app), injectInput(prog, { a: "hello", b: "world" }));`,
  },
  "str/literal": {
    description: "Lift a JS string into the DSL as a string literal node",
    code: `const app = mvfm(prelude);
const prog = app({ x: "number" }, ($) => {
  // Raw strings are lifted to str/literal nodes automatically
  return $.concat("value: ", $.show($.input.x));
});
await fold(defaults(app), injectInput(prog, { x: 42 }));`,
  },
  "str/compare": {
    description: "Three-way string comparison returning -1, 0, or 1 via the ord typeclass",
    code: `const app = mvfm(prelude);
const prog = app({ a: "string", b: "string" }, ($) => {
  return $.compare($.input.a, $.input.b);
});
await fold(defaults(app), injectInput(prog, { a: "apple", b: "banana" }));`,
  },
  "str/gt": {
    description: "String greater than — lexicographic comparison via the ord typeclass",
    code: `const app = mvfm(prelude);
const prog = app({ a: "string", b: "string" }, ($) => {
  return $.gt($.input.a, $.input.b);
});
await fold(defaults(app), injectInput(prog, { a: "banana", b: "apple" }));`,
  },
  "str/gte": {
    description: "String greater than or equal — lexicographic comparison via the ord typeclass",
    code: `const app = mvfm(prelude);
const prog = app({ a: "string", b: "string" }, ($) => {
  return $.gte($.input.a, $.input.b);
});
await fold(defaults(app), injectInput(prog, { a: "hello", b: "hello" }));`,
  },
  "str/lt": {
    description: "String less than — lexicographic comparison via the ord typeclass",
    code: `const app = mvfm(prelude);
const prog = app({ a: "string", b: "string" }, ($) => {
  return $.lt($.input.a, $.input.b);
});
await fold(defaults(app), injectInput(prog, { a: "apple", b: "banana" }));`,
  },
  "str/lte": {
    description: "String less than or equal — lexicographic comparison via the ord typeclass",
    code: `const app = mvfm(prelude);
const prog = app({ a: "string", b: "string" }, ($) => {
  return $.lte($.input.a, $.input.b);
});
await fold(defaults(app), injectInput(prog, { a: "abc", b: "xyz" }));`,
  },
  "str/show": {
    description: "Convert a string to its Show representation (identity for strings)",
    code: `const app = mvfm(prelude);
const prog = app({ s: "string" }, ($) => {
  // $.show dispatches to str/show for string expressions
  return $.show($.input.s);
});
await fold(defaults(app), injectInput(prog, { s: "hello" }));`,
  },
  "str/append": {
    description: "Append two strings via the semigroup typeclass",
    code: `const app = mvfm(prelude);
const prog = app({ a: "string", b: "string" }, ($) => {
  // $.append dispatches to str/append for string expressions
  return $.append($.input.a, $.input.b);
});
await fold(defaults(app), injectInput(prog, { a: "hello ", b: "world" }));`,
  },
  "str/mempty": {
    description: "Monoid identity for strings — the empty string",
    code: `const app = mvfm(prelude);
const prog = app({ s: "string" }, ($) => {
  // "" is the monoid identity for strings
  return $.append($.input.s, "");
});
await fold(defaults(app), injectInput(prog, { s: "unchanged" }));`,
  },
};

export { examples };
