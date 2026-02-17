import type { NodeExample } from "./types";

const examples: Record<string, NodeExample> = {
  "console/log": {
    description: "Log one or more values to the console",
    code: `const app = mvfm(prelude, console_);
const prog = app({ name: "string", n: "number" }, ($) => {
  return $.begin(
    $.console.log("hello", $.input.name, $.input.n),
    $.input.n
  );
});
await foldAST(defaults(app), injectInput(prog, { name: "world", n: 42 }));`,
  },
  "console/error": {
    description: "Write an error message to the console",
    code: `const app = mvfm(prelude, console_);
const prog = app({ msg: "string" }, ($) => {
  return $.begin($.console.error("Error:", $.input.msg), $.input.msg);
});
await foldAST(defaults(app), injectInput(prog, { msg: "something broke" }));`,
  },
  "console/warn": {
    description: "Write a warning message to the console",
    code: `const app = mvfm(prelude, console_);
const prog = app({ msg: "string" }, ($) => {
  return $.begin($.console.warn("Warning:", $.input.msg), $.input.msg);
});
await foldAST(defaults(app), injectInput(prog, { msg: "deprecated call" }));`,
  },
  "console/info": {
    description: "Write an informational message to the console",
    code: `const app = mvfm(prelude, console_);
const prog = app({ msg: "string" }, ($) => {
  return $.begin($.console.info("Info:", $.input.msg), $.input.msg);
});
await foldAST(defaults(app), injectInput(prog, { msg: "server started" }));`,
  },
  "console/debug": {
    description: "Write a debug-level message to the console",
    code: `const app = mvfm(prelude, console_);
const prog = app({ val: "number" }, ($) => {
  return $.begin($.console.debug("debug val:", $.input.val), $.input.val);
});
await foldAST(defaults(app), injectInput(prog, { val: 99 }));`,
  },
  "console/assert": {
    description: "Log an error if the assertion condition is false",
    code: `const app = mvfm(prelude, console_);
const prog = app({ x: "number" }, ($) => {
  const ok = $.gt($.input.x, 0);
  return $.begin($.console.assert(ok, "x must be positive"), $.input.x);
});
await foldAST(defaults(app), injectInput(prog, { x: 5 }));`,
  },
  "console/clear": {
    description: "Clear the console output",
    code: `const app = mvfm(prelude, console_);
const prog = app({ x: "number" }, ($) => {
  return $.begin($.console.clear(), $.input.x);
});
await foldAST(defaults(app), injectInput(prog, { x: 0 }));`,
  },
  "console/count": {
    description: "Increment and log a named counter",
    code: `const app = mvfm(prelude, console_);
const prog = app({ label: "string" }, ($) => {
  return $.begin(
    $.console.count($.input.label),
    $.console.count($.input.label),
    $.input.label
  );
});
await foldAST(defaults(app), injectInput(prog, { label: "hits" }));`,
  },
  "console/countReset": {
    description: "Reset a named counter previously started with count",
    code: `const app = mvfm(prelude, console_);
const prog = app({ label: "string" }, ($) => {
  return $.begin(
    $.console.count($.input.label),
    $.console.countReset($.input.label),
    $.input.label
  );
});
await foldAST(defaults(app), injectInput(prog, { label: "hits" }));`,
  },
  "console/dir": {
    description: "Display an interactive listing of an object's properties",
    code: `const app = mvfm(prelude, console_);
const prog = app({ x: "number" }, ($) => {
  return $.begin($.console.dir({ value: $.input.x }), $.input.x);
});
await foldAST(defaults(app), injectInput(prog, { x: 42 }));`,
  },
  "console/dirxml": {
    description: "Display an XML/HTML-like representation of an object",
    code: `const app = mvfm(prelude, console_);
const prog = app({ x: "number" }, ($) => {
  return $.begin($.console.dirxml({ value: $.input.x }), $.input.x);
});
await foldAST(defaults(app), injectInput(prog, { x: 7 }));`,
  },
  "console/group": {
    description: "Start an indented group of console messages",
    code: `const app = mvfm(prelude, console_);
const prog = app({ label: "string" }, ($) => {
  return $.begin(
    $.console.group($.input.label),
    $.console.log("inside group"),
    $.console.groupEnd(),
    $.input.label
  );
});
await foldAST(defaults(app), injectInput(prog, { label: "Details" }));`,
  },
  "console/groupCollapsed": {
    description: "Start an indented group that is initially collapsed",
    code: `const app = mvfm(prelude, console_);
const prog = app({ label: "string" }, ($) => {
  return $.begin(
    $.console.groupCollapsed($.input.label),
    $.console.log("hidden by default"),
    $.console.groupEnd(),
    $.input.label
  );
});
await foldAST(defaults(app), injectInput(prog, { label: "Collapsed" }));`,
  },
  "console/groupEnd": {
    description: "End the current indented console group",
    code: `const app = mvfm(prelude, console_);
const prog = app({ x: "number" }, ($) => {
  return $.begin(
    $.console.group("outer"),
    $.console.log("nested"),
    $.console.groupEnd(),
    $.input.x
  );
});
await foldAST(defaults(app), injectInput(prog, { x: 0 }));`,
  },
  "console/table": {
    description: "Display tabular data as a table in the console",
    code: `const app = mvfm(prelude, console_);
const prog = app({ n: "number" }, ($) => {
  return $.begin($.console.table([$.input.n, $.add($.input.n, 1)]), $.input.n);
});
await foldAST(defaults(app), injectInput(prog, { n: 10 }));`,
  },
  "console/time": {
    description: "Start a named timer for performance measurement",
    code: `const app = mvfm(prelude, console_);
const prog = app({ label: "string" }, ($) => {
  return $.begin(
    $.console.time($.input.label),
    $.console.timeEnd($.input.label),
    $.input.label
  );
});
await foldAST(defaults(app), injectInput(prog, { label: "op" }));`,
  },
  "console/timeEnd": {
    description: "Stop a named timer and log the elapsed time",
    code: `const app = mvfm(prelude, console_);
const prog = app({ label: "string" }, ($) => {
  return $.begin(
    $.console.time($.input.label),
    $.console.timeEnd($.input.label),
    $.input.label
  );
});
await foldAST(defaults(app), injectInput(prog, { label: "task" }));`,
  },
  "console/timeLog": {
    description: "Log the current value of a running timer without stopping it",
    code: `const app = mvfm(prelude, console_);
const prog = app({ label: "string" }, ($) => {
  return $.begin(
    $.console.time($.input.label),
    $.console.timeLog($.input.label, "checkpoint"),
    $.console.timeEnd($.input.label),
    $.input.label
  );
});
await foldAST(defaults(app), injectInput(prog, { label: "run" }));`,
  },
  "console/trace": {
    description: "Output a stack trace to the console",
    code: `const app = mvfm(prelude, console_);
const prog = app({ msg: "string" }, ($) => {
  return $.begin($.console.trace($.input.msg), $.input.msg);
});
await foldAST(defaults(app), injectInput(prog, { msg: "trace point" }));`,
  },
};

export default examples;
