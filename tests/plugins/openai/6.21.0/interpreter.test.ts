import { describe, expect, it } from "vitest";
import { foldAST, mvfm } from "../../../../src/core";
import { coreInterpreter } from "../../../../src/interpreters/core";
import { num } from "../../../../src/plugins/num";
import { openai } from "../../../../src/plugins/openai/6.21.0";
import { openaiInterpreter } from "../../../../src/plugins/openai/6.21.0/interpreter";
import { str } from "../../../../src/plugins/str";

const app = mvfm(num, str, openai({ apiKey: "sk-test-123" }));
const fragments = [openaiInterpreter, coreInterpreter];

function injectInput(node: any, input: Record<string, unknown>): any {
  if (node === null || node === undefined || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map((n) => injectInput(n, input));
  const result: any = {};
  for (const [k, v] of Object.entries(node)) {
    result[k] = injectInput(v, input);
  }
  if (result.kind === "core/input") result.__inputData = input;
  return result;
}

async function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const captured: any[] = [];
  const ast = injectInput(prog.ast, input);
  const recurse = foldAST(fragments, {
    "openai/api_call": async (effect) => {
      captured.push(effect);
      return { id: "mock_id", object: "mock" };
    },
  });
  const result = await recurse(ast.result);
  return { result, captured };
}

// ============================================================
// Chat Completions
// ============================================================

describe("openai interpreter: create_chat_completion", () => {
  it("yields POST /chat/completions with correct body", async () => {
    const prog = app(($) =>
      $.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hello" }],
      }),
    );
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("openai/api_call");
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/chat/completions");
    expect(captured[0].body).toEqual({
      model: "gpt-4o",
      messages: [{ role: "user", content: "Hello" }],
    });
  });
});

describe("openai interpreter: retrieve_chat_completion", () => {
  it("yields GET /chat/completions/{id}", async () => {
    const prog = app(($) => $.openai.chat.completions.retrieve("cmpl_123"));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("openai/api_call");
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/chat/completions/cmpl_123");
    expect(captured[0].body).toBeUndefined();
  });
});

describe("openai interpreter: list_chat_completions", () => {
  it("yields GET /chat/completions with query params", async () => {
    const prog = app(($) => $.openai.chat.completions.list({ model: "gpt-4o", limit: 10 }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("openai/api_call");
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/chat/completions");
    expect(captured[0].body).toEqual({ model: "gpt-4o", limit: 10 });
  });

  it("yields GET /chat/completions with undefined body when omitted", async () => {
    const prog = app(($) => $.openai.chat.completions.list());
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/chat/completions");
    expect(captured[0].body).toBeUndefined();
  });
});

describe("openai interpreter: update_chat_completion", () => {
  it("yields POST /chat/completions/{id} with body", async () => {
    const prog = app(($) =>
      $.openai.chat.completions.update("cmpl_123", { metadata: { key: "value" } }),
    );
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("openai/api_call");
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/chat/completions/cmpl_123");
    expect(captured[0].body).toEqual({ metadata: { key: "value" } });
  });
});

describe("openai interpreter: delete_chat_completion", () => {
  it("yields DELETE /chat/completions/{id}", async () => {
    const prog = app(($) => $.openai.chat.completions.delete("cmpl_123"));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("openai/api_call");
    expect(captured[0].method).toBe("DELETE");
    expect(captured[0].path).toBe("/chat/completions/cmpl_123");
    expect(captured[0].body).toBeUndefined();
  });
});

// ============================================================
// Embeddings
// ============================================================

describe("openai interpreter: create_embedding", () => {
  it("yields POST /embeddings with correct body", async () => {
    const prog = app(($) =>
      $.openai.embeddings.create({
        model: "text-embedding-3-small",
        input: "Hello world",
      }),
    );
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("openai/api_call");
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/embeddings");
    expect(captured[0].body).toEqual({
      model: "text-embedding-3-small",
      input: "Hello world",
    });
  });
});

// ============================================================
// Moderations
// ============================================================

describe("openai interpreter: create_moderation", () => {
  it("yields POST /moderations with correct body", async () => {
    const prog = app(($) =>
      $.openai.moderations.create({
        model: "omni-moderation-latest",
        input: "some text",
      }),
    );
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("openai/api_call");
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/moderations");
    expect(captured[0].body).toEqual({
      model: "omni-moderation-latest",
      input: "some text",
    });
  });
});

// ============================================================
// Legacy Completions
// ============================================================

describe("openai interpreter: create_completion", () => {
  it("yields POST /completions with correct body", async () => {
    const prog = app(($) =>
      $.openai.completions.create({
        model: "gpt-3.5-turbo-instruct",
        prompt: "Say hello",
      }),
    );
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("openai/api_call");
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/completions");
    expect(captured[0].body).toEqual({
      model: "gpt-3.5-turbo-instruct",
      prompt: "Say hello",
    });
  });
});

// ============================================================
// Input resolution
// ============================================================

describe("openai interpreter: input resolution", () => {
  it("resolves input params through recurse", async () => {
    const prog = app({ model: "string", content: "string" }, ($) =>
      $.openai.chat.completions.create({
        model: $.input.model,
        messages: [{ role: "user", content: $.input.content }],
      }),
    );
    const { captured } = await run(prog, { model: "gpt-4o", content: "Hi" });
    expect(captured).toHaveLength(1);
    expect(captured[0].body.model).toBe("gpt-4o");
  });

  it("resolves input id for retrieve", async () => {
    const prog = app({ completionId: "string" }, ($) =>
      $.openai.chat.completions.retrieve($.input.completionId),
    );
    const { captured } = await run(prog, { completionId: "cmpl_dynamic_456" });
    expect(captured).toHaveLength(1);
    expect(captured[0].path).toBe("/chat/completions/cmpl_dynamic_456");
  });
});

// ============================================================
// Return value
// ============================================================

describe("openai interpreter: return value", () => {
  it("returns the handler response as the result", async () => {
    const prog = app(($) => $.openai.chat.completions.retrieve("cmpl_123"));
    const { result } = await run(prog);
    expect(result).toEqual({ id: "mock_id", object: "mock" });
  });
});
