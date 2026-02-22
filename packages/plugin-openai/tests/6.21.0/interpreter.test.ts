import { boolPluginU, createApp, defaults, fold, mvfmU, numPluginU, strPluginU } from "@mvfm/core";
import { describe, expect, it, vi } from "vitest";
import { openaiInterpreter } from "../../src";
import { openai } from "../../src/6.21.0";
import { createOpenAIInterpreter, type OpenAIClient } from "../../src/6.21.0/interpreter";

const plugin = openai({ apiKey: "sk-test-123" });
const plugins = [numPluginU, strPluginU, boolPluginU, plugin] as const;
const $ = mvfmU(...plugins);
const app = createApp(...plugins);

async function run(expr: unknown) {
  const captured: Array<{
    method: string;
    path: string;
    body?: Record<string, unknown>;
  }> = [];
  const mockClient: OpenAIClient = {
    async request(method, path, body) {
      captured.push({ method, path, body });
      return { id: "mock_id", object: "mock" };
    },
  };
  const nexpr = app(expr as Parameters<typeof app>[0]);
  const interp = defaults(plugins, {
    openai: createOpenAIInterpreter(mockClient),
  });
  const result = await fold(nexpr, interp);
  return { result, captured };
}

// ============================================================
// Default interpreter
// ============================================================

describe("openai interpreter: default export", () => {
  it("openaiInterpreter throws when OPENAI_API_KEY is missing", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const expr = $.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: "Hello" }],
    });
    const nexpr = app(expr as Parameters<typeof app>[0]);
    const stdInterp = defaults([numPluginU, strPluginU, boolPluginU]);
    const combined = { ...stdInterp, ...openaiInterpreter };
    await expect(fold(nexpr, combined)).rejects.toThrow(/OPENAI_API_KEY/);
    vi.unstubAllEnvs();
  });

  it("exports a default ready-to-use interpreter with OPENAI_API_KEY", () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test-default");
    expect(typeof openaiInterpreter["openai/create_chat_completion"]).toBe("function");
    vi.unstubAllEnvs();
  });
});

// ============================================================
// Chat Completions
// ============================================================

describe("openai interpreter: create_chat_completion", () => {
  it("calls POST /chat/completions with correct body", async () => {
    const expr = $.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: "Hello" }],
    });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/chat/completions");
    expect(captured[0].body).toEqual({
      model: "gpt-4o",
      messages: [{ role: "user", content: "Hello" }],
    });
  });
});

describe("openai interpreter: retrieve_chat_completion", () => {
  it("calls GET /chat/completions/{id}", async () => {
    const expr = $.openai.chat.completions.retrieve("cmpl_123");
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/chat/completions/cmpl_123");
    expect(captured[0].body).toBeUndefined();
  });
});

describe("openai interpreter: list_chat_completions", () => {
  it("calls GET /chat/completions with query params", async () => {
    const expr = $.openai.chat.completions.list({ model: "gpt-4o", limit: 10 });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/chat/completions");
    expect(captured[0].body).toEqual({ model: "gpt-4o", limit: 10 });
  });

  it("calls GET /chat/completions with undefined body when omitted", async () => {
    const expr = $.openai.chat.completions.list();
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/chat/completions");
    expect(captured[0].body).toBeUndefined();
  });
});

describe("openai interpreter: update_chat_completion", () => {
  it("calls POST /chat/completions/{id} with body", async () => {
    const expr = $.openai.chat.completions.update("cmpl_123", {
      metadata: { key: "value" },
    });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/chat/completions/cmpl_123");
    expect(captured[0].body).toEqual({ metadata: { key: "value" } });
  });
});

describe("openai interpreter: delete_chat_completion", () => {
  it("calls DELETE /chat/completions/{id}", async () => {
    const expr = $.openai.chat.completions.delete("cmpl_123");
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("DELETE");
    expect(captured[0].path).toBe("/chat/completions/cmpl_123");
    expect(captured[0].body).toBeUndefined();
  });
});

// ============================================================
// Embeddings
// ============================================================

describe("openai interpreter: create_embedding", () => {
  it("calls POST /embeddings with correct body", async () => {
    const expr = $.openai.embeddings.create({
      model: "text-embedding-3-small",
      input: "Hello world",
    });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
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
  it("calls POST /moderations with correct body", async () => {
    const expr = $.openai.moderations.create({
      model: "omni-moderation-latest",
      input: "some text",
    });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
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
  it("calls POST /completions with correct body", async () => {
    const expr = $.openai.completions.create({
      model: "gpt-3.5-turbo-instruct",
      prompt: "Say hello",
    });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/completions");
    expect(captured[0].body).toEqual({
      model: "gpt-3.5-turbo-instruct",
      prompt: "Say hello",
    });
  });
});

// ============================================================
// Return value
// ============================================================

describe("openai interpreter: return value", () => {
  it("returns the client response as the result", async () => {
    const expr = $.openai.chat.completions.retrieve("cmpl_123");
    const { result } = await run(expr);
    expect(result).toEqual({ id: "mock_id", object: "mock" });
  });
});
