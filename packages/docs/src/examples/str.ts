import type { NodeExample } from "./types";

const examples: Record<string, NodeExample> = {
  "str/template": {
    description: "Tagged template literal for string interpolation",
    code: `const app = mvfm(prelude, console_);
const prog = app({ name: "string", age: "number" }, ($) => {
  const msg = $.str\`Hello \${$.input.name}, age \${$.input.age}\`;
  return $.begin($.console.log(msg), msg);
});
await foldAST(defaults(app), injectInput(prog, { name: "Alice", age: 30 }));`,
  },
  "str/concat": {
    description: "Concatenate multiple string values into one",
    code: `const app = mvfm(prelude, console_);
const prog = app({ first: "string", last: "string" }, ($) => {
  const full = $.concat($.input.first, " ", $.input.last);
  return $.begin($.console.log(full), full);
});
await foldAST(
  defaults(app),
  injectInput(prog, { first: "Jane", last: "Doe" })
);`,
  },
  "str/upper": {
    description: "Convert a string to uppercase",
    code: `const app = mvfm(prelude, console_);
const prog = app({ s: "string" }, ($) => {
  const result = $.upper($.input.s);
  return $.begin($.console.log(result), result);
});
await foldAST(defaults(app), injectInput(prog, { s: "hello world" }));`,
  },
  "str/lower": {
    description: "Convert a string to lowercase",
    code: `const app = mvfm(prelude, console_);
const prog = app({ s: "string" }, ($) => {
  const result = $.lower($.input.s);
  return $.begin($.console.log(result), result);
});
await foldAST(defaults(app), injectInput(prog, { s: "HELLO WORLD" }));`,
  },
  "str/trim": {
    description: "Remove leading and trailing whitespace from a string",
    code: `const app = mvfm(prelude, console_);
const prog = app({ s: "string" }, ($) => {
  const result = $.trim($.input.s);
  return $.begin($.console.log(result), result);
});
await foldAST(defaults(app), injectInput(prog, { s: "  padded  " }));`,
  },
  "str/slice": {
    description: "Extract a substring by start and optional end index",
    code: `const app = mvfm(prelude, console_);
const prog = app({ s: "string" }, ($) => {
  const result = $.slice($.input.s, 0, 5);
  return $.begin($.console.log(result), result);
});
await foldAST(defaults(app), injectInput(prog, { s: "hello world" }));`,
  },
  "str/includes": {
    description: "Test whether a string contains a given substring",
    code: `const app = mvfm(prelude, console_);
const prog = app({ s: "string" }, ($) => {
  const found = $.includes($.input.s, "world");
  return $.begin(
    $.console.log($.cond(found).t("found it").f("not found")),
    found
  );
});
await foldAST(defaults(app), injectInput(prog, { s: "hello world" }));`,
  },
  "str/startsWith": {
    description: "Test whether a string starts with a given prefix",
    code: `const app = mvfm(prelude, console_);
const prog = app({ s: "string" }, ($) => {
  const yes = $.startsWith($.input.s, "http");
  return $.begin(
    $.console.log($.cond(yes).t("is URL").f("not URL")),
    yes
  );
});
await foldAST(defaults(app), injectInput(prog, { s: "https://example.com" }));`,
  },
  "str/endsWith": {
    description: "Test whether a string ends with a given suffix",
    code: `const app = mvfm(prelude, console_);
const prog = app({ s: "string" }, ($) => {
  const yes = $.endsWith($.input.s, ".ts");
  return $.begin(
    $.console.log($.cond(yes).t("TypeScript").f("other")),
    yes
  );
});
await foldAST(defaults(app), injectInput(prog, { s: "index.ts" }));`,
  },
  "str/split": {
    description: "Split a string by a delimiter into an array",
    code: `const app = mvfm(prelude, console_);
const prog = app({ csv: "string" }, ($) => {
  const parts = $.split($.input.csv, ",");
  return $.begin($.console.log($.show($.len($.input.csv))), parts);
});
await foldAST(defaults(app), injectInput(prog, { csv: "a,b,c" }));`,
  },
  "str/join": {
    description: "Join an array of strings with a separator",
    code: `const app = mvfm(prelude, console_);
const prog = app({ csv: "string" }, ($) => {
  const parts = $.split($.input.csv, ",");
  const rejoined = $.join(parts, " | ");
  return $.begin($.console.log(rejoined), rejoined);
});
await foldAST(defaults(app), injectInput(prog, { csv: "x,y,z" }));`,
  },
  "str/replace": {
    description: "Replace the first occurrence of a search string",
    code: `const app = mvfm(prelude, console_);
const prog = app({ s: "string" }, ($) => {
  const result = $.replace($.input.s, "world", "MVFM");
  return $.begin($.console.log(result), result);
});
await foldAST(defaults(app), injectInput(prog, { s: "hello world" }));`,
  },
  "str/len": {
    description: "Get the length of a string",
    code: `const app = mvfm(prelude, console_);
const prog = app({ s: "string" }, ($) => {
  const n = $.len($.input.s);
  return $.begin($.console.log($.show(n)), n);
});
await foldAST(defaults(app), injectInput(prog, { s: "hello" }));`,
  },
  "str/eq": {
    description: "String equality — compares two strings via the eq typeclass",
    code: `const app = mvfm(prelude, console_);
const prog = app({ a: "string", b: "string" }, ($) => {
  const same = $.eq($.input.a, $.input.b);
  return $.begin(
    $.console.log($.cond(same).t("match").f("no match")),
    same
  );
});
await foldAST(defaults(app), injectInput(prog, { a: "hi", b: "hi" }));`,
  },
  "str/show": {
    description: "Convert a string to its Show representation (identity for strings)",
    code: `const app = mvfm(prelude, console_);
const prog = app({ s: "string" }, ($) => {
  // $.show dispatches to str/show for string expressions
  const shown = $.show($.input.s);
  return $.begin($.console.log(shown), shown);
});
await foldAST(defaults(app), injectInput(prog, { s: "hello" }));`,
  },
  "str/append": {
    description: "Append two strings via the semigroup typeclass",
    code: `const app = mvfm(prelude, console_);
const prog = app({ a: "string", b: "string" }, ($) => {
  // $.append dispatches to str/append for string expressions
  const result = $.append($.input.a, $.input.b);
  return $.begin($.console.log(result), result);
});
await foldAST(defaults(app), injectInput(prog, { a: "hello ", b: "world" }));`,
  },
  "str/mempty": {
    description: "Monoid identity for strings — the empty string",
    code: `const app = mvfm(prelude, console_);
const prog = app({ s: "string" }, ($) => {
  // "" is the monoid identity for strings
  const result = $.append($.input.s, "");
  return $.begin($.console.log(result), result);
});
await foldAST(defaults(app), injectInput(prog, { s: "unchanged" }));`,
  },
};

export default examples;
