import type { NodeExample } from "./types";

const OPENAI = ["@mvfm/plugin-openai"];

const examples: Record<string, NodeExample> = {
  "openai/create_chat_completion": {
    description: "Create a chat completion from a list of messages",
    code: `const app = mvfm(prelude, console_, openai_);
const prog = app({}, ($) => {
  const result = $.openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "Say hello" }],
  });
  return $.console.log(result);
});
await foldAST(defaults(app, { openai: crystalBallOpenAIInterpreter }), prog);`,
    plugins: OPENAI,
  },

  "openai/retrieve_chat_completion": {
    description: "Retrieve a previously stored chat completion by ID",
    code: `const app = mvfm(prelude, console_, openai_);
const prog = app({}, ($) => {
  const result = $.openai.chat.completions.retrieve("chatcmpl-abc123");
  return $.console.log(result);
});
await foldAST(defaults(app, { openai: crystalBallOpenAIInterpreter }), prog);`,
    plugins: OPENAI,
  },

  "openai/list_chat_completions": {
    description: "List stored chat completions with optional filters",
    code: `const app = mvfm(prelude, console_, openai_);
const prog = app({}, ($) => {
  const page = $.openai.chat.completions.list({ limit: 5 });
  return $.console.log(page);
});
await foldAST(defaults(app, { openai: crystalBallOpenAIInterpreter }), prog);`,
    plugins: OPENAI,
  },

  "openai/update_chat_completion": {
    description: "Update metadata on a stored chat completion",
    code: `const app = mvfm(prelude, console_, openai_);
const prog = app({}, ($) => {
  const updated = $.openai.chat.completions.update("chatcmpl-abc123", {
    metadata: { reviewed: "true", tag: "greeting" },
  });
  return $.console.log(updated);
});
await foldAST(defaults(app, { openai: crystalBallOpenAIInterpreter }), prog);`,
    plugins: OPENAI,
  },

  "openai/delete_chat_completion": {
    description: "Delete a stored chat completion by ID",
    code: `const app = mvfm(prelude, console_, openai_);
const prog = app({}, ($) => {
  const result = $.openai.chat.completions.delete("chatcmpl-abc123");
  return $.console.log(result);
});
await foldAST(defaults(app, { openai: crystalBallOpenAIInterpreter }), prog);`,
    plugins: OPENAI,
  },

  "openai/create_embedding": {
    description: "Create a vector embedding for a piece of text",
    code: `const app = mvfm(prelude, console_, openai_);
const prog = app({}, ($) => {
  const result = $.openai.embeddings.create({
    model: "text-embedding-3-small",
    input: "The quick brown fox",
  });
  return $.console.log(result);
});
await foldAST(defaults(app, { openai: crystalBallOpenAIInterpreter }), prog);`,
    plugins: OPENAI,
  },

  "openai/create_moderation": {
    description: "Check text against content policy categories",
    code: `const app = mvfm(prelude, console_, openai_);
const prog = app({}, ($) => {
  const result = $.openai.moderations.create({
    model: "omni-moderation-latest",
    input: "This is a perfectly friendly message.",
  });
  return $.console.log(result);
});
await foldAST(defaults(app, { openai: crystalBallOpenAIInterpreter }), prog);`,
    plugins: OPENAI,
  },

  "openai/create_completion": {
    description: "Create a legacy text completion from a prompt string",
    code: `const app = mvfm(prelude, console_, openai_);
const prog = app({}, ($) => {
  const result = $.openai.completions.create({
    model: "gpt-3.5-turbo-instruct",
    prompt: "Once upon a time",
    max_tokens: 32,
  });
  return $.console.log(result);
});
await foldAST(defaults(app, { openai: crystalBallOpenAIInterpreter }), prog);`,
    plugins: OPENAI,
  },
};

export default examples;
