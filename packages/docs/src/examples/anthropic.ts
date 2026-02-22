import type { NodeExample } from "./types";

const ANTHROPIC = ["@mvfm/plugin-anthropic"];

const examples: Record<string, NodeExample> = {
  "anthropic/create_message": {
    description: "Create a message (chat completion) via the Anthropic API",
    code: `const app = mvfm(prelude, console_, anthropic_);
const prog = app({}, ($) => {
  const msg = $.anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 128,
    messages: [{ role: "user", content: "Say hello" }],
  });
  return $.console.log(msg);
});
await fold(defaults(app, { anthropic: crystalBallAnthropicInterpreter }), prog);`,
    plugins: ANTHROPIC,
  },

  "anthropic/count_tokens": {
    description: "Count tokens for a message request without sending it",
    code: `const app = mvfm(prelude, console_, anthropic_);
const prog = app({}, ($) => {
  const count = $.anthropic.messages.countTokens({
    model: "claude-sonnet-4-20250514",
    messages: [{ role: "user", content: "How many tokens is this?" }],
  });
  return $.console.log(count);
});
await fold(defaults(app, { anthropic: crystalBallAnthropicInterpreter }), prog);`,
    plugins: ANTHROPIC,
  },

  "anthropic/create_message_batch": {
    description: "Create a batch of message requests for async processing",
    code: `const app = mvfm(prelude, console_, anthropic_);
const prog = app({}, ($) => {
  const batch = $.anthropic.messages.batches.create({
    requests: [{
      custom_id: "req-001",
      params: {
        model: "claude-sonnet-4-20250514",
        max_tokens: 64,
        messages: [{ role: "user", content: "Hello" }],
      },
    }],
  });
  return $.console.log(batch);
});
await fold(defaults(app, { anthropic: crystalBallAnthropicInterpreter }), prog);`,
    plugins: ANTHROPIC,
  },

  "anthropic/retrieve_message_batch": {
    description: "Retrieve the status of a message batch by ID",
    code: `const app = mvfm(prelude, console_, anthropic_);
const prog = app({}, ($) => {
  const batch = $.anthropic.messages.batches.retrieve("msgbatch-abc123");
  return $.console.log(batch);
});
await fold(defaults(app, { anthropic: crystalBallAnthropicInterpreter }), prog);`,
    plugins: ANTHROPIC,
  },

  "anthropic/list_message_batches": {
    description: "List message batches with optional pagination",
    code: `const app = mvfm(prelude, console_, anthropic_);
const prog = app({}, ($) => {
  const page = $.anthropic.messages.batches.list({ limit: 5 });
  return $.console.log(page);
});
await fold(defaults(app, { anthropic: crystalBallAnthropicInterpreter }), prog);`,
    plugins: ANTHROPIC,
  },

  "anthropic/delete_message_batch": {
    description: "Delete a message batch by ID",
    code: `const app = mvfm(prelude, console_, anthropic_);
const prog = app({}, ($) => {
  const result = $.anthropic.messages.batches.delete("msgbatch-abc123");
  return $.console.log(result);
});
await fold(defaults(app, { anthropic: crystalBallAnthropicInterpreter }), prog);`,
    plugins: ANTHROPIC,
  },

  "anthropic/cancel_message_batch": {
    description: "Cancel an in-progress message batch",
    code: `const app = mvfm(prelude, console_, anthropic_);
const prog = app({}, ($) => {
  const batch = $.anthropic.messages.batches.cancel("msgbatch-abc123");
  return $.console.log(batch);
});
await fold(defaults(app, { anthropic: crystalBallAnthropicInterpreter }), prog);`,
    plugins: ANTHROPIC,
  },

  "anthropic/retrieve_model": {
    description: "Retrieve details about a specific model",
    code: `const app = mvfm(prelude, console_, anthropic_);
const prog = app({}, ($) => {
  const model = $.anthropic.models.retrieve("claude-sonnet-4-20250514");
  return $.console.log(model);
});
await fold(defaults(app, { anthropic: crystalBallAnthropicInterpreter }), prog);`,
    plugins: ANTHROPIC,
  },

  "anthropic/list_models": {
    description: "List available models with optional pagination",
    code: `const app = mvfm(prelude, console_, anthropic_);
const prog = app({}, ($) => {
  const page = $.anthropic.models.list({ limit: 10 });
  return $.console.log(page);
});
await fold(defaults(app, { anthropic: crystalBallAnthropicInterpreter }), prog);`,
    plugins: ANTHROPIC,
  },
};

export default examples;
