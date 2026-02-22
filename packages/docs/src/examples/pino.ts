import type { NodeExample } from "./types";

const PINO = ["@mvfm/plugin-pino"];

const examples: Record<string, NodeExample> = {
  "pino/trace": {
    description: "Log a trace-level message for fine-grained debugging",
    code: `const app = mvfm(prelude, pino_);
const prog = app({ reqId: "string" }, ($) => {
  return $.begin(
    $.pino.trace({ reqId: $.input.reqId }, "entering handler"),
    $.input.reqId
  );
});
await fold(defaults(app), injectInput(prog, { reqId: "abc-123" }));`,
    plugins: PINO,
  },

  "pino/debug": {
    description: "Log a debug-level message with contextual data",
    code: `const app = mvfm(prelude, pino_);
const prog = app({ userId: "number" }, ($) => {
  return $.begin(
    $.pino.debug({ userId: $.input.userId }, "loading profile"),
    $.input.userId
  );
});
await fold(defaults(app), injectInput(prog, { userId: 42 }));`,
    plugins: PINO,
  },

  "pino/info": {
    description: "Log an informational message about normal operations",
    code: `const app = mvfm(prelude, pino_);
const prog = app({ port: "number" }, ($) => {
  return $.begin(
    $.pino.info("server started on port"),
    $.input.port
  );
});
await fold(defaults(app), injectInput(prog, { port: 3000 }));`,
    plugins: PINO,
  },

  "pino/warn": {
    description: "Log a warning about a potentially harmful situation",
    code: `const app = mvfm(prelude, pino_);
const prog = app({ retries: "number" }, ($) => {
  return $.begin(
    $.pino.warn({ retries: $.input.retries }, "retry limit approaching"),
    $.input.retries
  );
});
await fold(defaults(app), injectInput(prog, { retries: 4 }));`,
    plugins: PINO,
  },

  "pino/error": {
    description: "Log an error-level message when something goes wrong",
    code: `const app = mvfm(prelude, pino_);
const prog = app({ code: "number" }, ($) => {
  return $.begin(
    $.pino.error({ code: $.input.code }, "request failed"),
    $.input.code
  );
});
await fold(defaults(app), injectInput(prog, { code: 500 }));`,
    plugins: PINO,
  },

  "pino/fatal": {
    description: "Log a fatal message indicating an unrecoverable error",
    code: `const app = mvfm(prelude, pino_);
const prog = app({ reason: "string" }, ($) => {
  return $.begin(
    $.pino.fatal({ reason: $.input.reason }, "shutting down"),
    $.input.reason
  );
});
await fold(defaults(app), injectInput(prog, { reason: "out of memory" }));`,
    plugins: PINO,
  },
};

export default examples;
