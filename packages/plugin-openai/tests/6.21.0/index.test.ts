import { describe, expect, it } from "vitest";
import { openai, openaiPlugin } from "../../src/6.21.0";

const plugin = openai({ apiKey: "sk-test-123" });
const api = plugin.ctors.openai;

// ============================================================
// CExpr construction tests
// ============================================================

describe("openai: chat.completions.create", () => {
  it("produces openai/create_chat_completion CExpr", () => {
    const expr = api.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: "Hello" }],
    });
    expect(expr.__kind).toBe("openai/create_chat_completion");
    expect(expr.__args).toHaveLength(1);
    expect(expr.__args[0]).toEqual({
      model: "gpt-4o",
      messages: [{ role: "user", content: "Hello" }],
    });
  });
});

describe("openai: chat.completions.retrieve", () => {
  it("produces openai/retrieve_chat_completion CExpr with string id", () => {
    const expr = api.chat.completions.retrieve("cmpl_123");
    expect(expr.__kind).toBe("openai/retrieve_chat_completion");
    expect(expr.__args).toHaveLength(1);
    expect(expr.__args[0]).toBe("cmpl_123");
  });

  it("accepts CExpr id (proxy chained value)", () => {
    const completion = api.chat.completions.retrieve("cmpl_123");
    const expr = api.chat.completions.retrieve(completion.id);
    expect(expr.__kind).toBe("openai/retrieve_chat_completion");
    expect(expr.__args).toHaveLength(1);
    const idArg = expr.__args[0] as { __kind: string };
    expect(idArg.__kind).toBe("core/access");
  });
});

describe("openai: chat.completions.list", () => {
  it("produces openai/list_chat_completions CExpr with params", () => {
    const expr = api.chat.completions.list({ model: "gpt-4o", limit: 10 });
    expect(expr.__kind).toBe("openai/list_chat_completions");
    expect(expr.__args).toHaveLength(1);
    expect(expr.__args[0]).toEqual({ model: "gpt-4o", limit: 10 });
  });

  it("produces CExpr with no args when omitted", () => {
    const expr = api.chat.completions.list();
    expect(expr.__kind).toBe("openai/list_chat_completions");
    expect(expr.__args).toHaveLength(0);
  });
});

describe("openai: chat.completions.update", () => {
  it("produces openai/update_chat_completion CExpr", () => {
    const expr = api.chat.completions.update("cmpl_123", {
      metadata: { key: "value" },
    });
    expect(expr.__kind).toBe("openai/update_chat_completion");
    expect(expr.__args).toHaveLength(2);
    expect(expr.__args[0]).toBe("cmpl_123");
    expect(expr.__args[1]).toEqual({ metadata: { key: "value" } });
  });
});

describe("openai: chat.completions.delete", () => {
  it("produces openai/delete_chat_completion CExpr", () => {
    const expr = api.chat.completions.delete("cmpl_123");
    expect(expr.__kind).toBe("openai/delete_chat_completion");
    expect(expr.__args).toHaveLength(1);
    expect(expr.__args[0]).toBe("cmpl_123");
  });
});

// ============================================================
// Embeddings
// ============================================================

describe("openai: embeddings.create", () => {
  it("produces openai/create_embedding CExpr", () => {
    const expr = api.embeddings.create({
      model: "text-embedding-3-small",
      input: "Hello world",
    });
    expect(expr.__kind).toBe("openai/create_embedding");
    expect(expr.__args).toHaveLength(1);
    expect(expr.__args[0]).toEqual({
      model: "text-embedding-3-small",
      input: "Hello world",
    });
  });
});

// ============================================================
// Moderations
// ============================================================

describe("openai: moderations.create", () => {
  it("produces openai/create_moderation CExpr", () => {
    const expr = api.moderations.create({
      model: "omni-moderation-latest",
      input: "some text to moderate",
    });
    expect(expr.__kind).toBe("openai/create_moderation");
    expect(expr.__args).toHaveLength(1);
    expect(expr.__args[0]).toEqual({
      model: "omni-moderation-latest",
      input: "some text to moderate",
    });
  });
});

// ============================================================
// Legacy Completions
// ============================================================

describe("openai: completions.create", () => {
  it("produces openai/create_completion CExpr", () => {
    const expr = api.completions.create({
      model: "gpt-3.5-turbo-instruct",
      prompt: "Say hello",
    });
    expect(expr.__kind).toBe("openai/create_completion");
    expect(expr.__args).toHaveLength(1);
    expect(expr.__args[0]).toEqual({
      model: "gpt-3.5-turbo-instruct",
      prompt: "Say hello",
    });
  });
});

// ============================================================
// Unified Plugin shape
// ============================================================

describe("openai plugin: unified Plugin shape", () => {
  it("has correct name", () => {
    expect(plugin.name).toBe("openai");
  });

  it("has 8 node kinds", () => {
    expect(Object.keys(plugin.kinds)).toHaveLength(8);
  });

  it("kinds are all namespaced", () => {
    for (const kind of Object.keys(plugin.kinds)) {
      expect(kind).toMatch(/^openai\//);
    }
  });

  it("kinds map has entries for all node kinds", () => {
    for (const kind of Object.keys(plugin.kinds)) {
      expect(plugin.kinds[kind]).toBeDefined();
    }
  });

  it("has empty traits and lifts", () => {
    expect(plugin.traits).toEqual({});
    expect(plugin.lifts).toEqual({});
  });

  it("has a defaultInterpreter factory", () => {
    expect(typeof plugin.defaultInterpreter).toBe("function");
  });
});

// ============================================================
// Factory aliases
// ============================================================

describe("openai plugin: factory aliases", () => {
  it("openai and openaiPlugin are the same function", () => {
    expect(openai).toBe(openaiPlugin);
  });
});
