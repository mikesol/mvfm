import type { NodeExample } from "./types";

const FAL = ["@mvfm/plugin-fal"];

const examples: Record<string, NodeExample> = {
  "fal/run": {
    description: "Run a Fal endpoint directly and get the completed result",
    code: `const app = mvfm(prelude, console_, fal_);
const prog = app({}, ($) => {
  const result = $.fal.run("fal-ai/flux/dev", {
    input: { prompt: "A friendly robot waving" },
  });
  return $.console.log(result);
});
await fold(defaults(app, { fal: crystalBallFalInterpreter }), prog);`,
    plugins: FAL,
  },

  "fal/subscribe": {
    description: "Subscribe to a Fal request lifecycle and await the final result",
    code: `const app = mvfm(prelude, console_, fal_);
const prog = app({}, ($) => {
  const result = $.fal.subscribe("fal-ai/flux/dev", {
    input: { prompt: "A watercolor mountain landscape" },
  });
  return $.console.log(result);
});
await fold(defaults(app, { fal: crystalBallFalInterpreter }), prog);`,
    plugins: FAL,
  },

  "fal/queue_submit": {
    description: "Submit a Fal request to the queue for async processing",
    code: `const app = mvfm(prelude, console_, fal_);
const prog = app({}, ($) => {
  const queued = $.fal.queue.submit("fal-ai/flux/dev", {
    input: { prompt: "A neon city at night" },
  });
  return $.console.log(queued);
});
await fold(defaults(app, { fal: crystalBallFalInterpreter }), prog);`,
    plugins: FAL,
  },

  "fal/queue_status": {
    description: "Check the current status of a queued Fal request",
    code: `const app = mvfm(prelude, console_, fal_);
const prog = app({}, ($) => {
  const status = $.fal.queue.status("fal-ai/flux/dev", {
    requestId: "req-crystal-ball-001",
  });
  return $.console.log(status);
});
await fold(defaults(app, { fal: crystalBallFalInterpreter }), prog);`,
    plugins: FAL,
  },

  "fal/queue_result": {
    description: "Retrieve the final result for a completed queued Fal request",
    code: `const app = mvfm(prelude, console_, fal_);
const prog = app({}, ($) => {
  const result = $.fal.queue.result("fal-ai/flux/dev", {
    requestId: "req-crystal-ball-001",
  });
  return $.console.log(result);
});
await fold(defaults(app, { fal: crystalBallFalInterpreter }), prog);`,
    plugins: FAL,
  },

  "fal/queue_cancel": {
    description: "Cancel a queued Fal request by request ID",
    code: `const app = mvfm(prelude, console_, fal_);
const prog = app({}, ($) => {
  const canceled = $.fal.queue.cancel("fal-ai/flux/dev", {
    requestId: "req-crystal-ball-001",
  });
  return $.console.log(canceled);
});
await fold(defaults(app, { fal: crystalBallFalInterpreter }), prog);`,
    plugins: FAL,
  },
};

export default examples;
