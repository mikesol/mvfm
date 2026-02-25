import { describe, expect, it } from "vitest";
import { anthropic, anthropicPlugin } from "../../src/0.74.0";

const plugin = anthropic({ apiKey: "sk-ant-test-123" });
const api = plugin.ctors.anthropic;

// ============================================================
// CExpr construction tests
// ============================================================

describe("anthropic: messages.create", () => {
  it("produces anthropic/create_message CExpr", () => {
    const expr = api.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: "Hello" }],
    });
    expect(expr.__kind).toBe("anthropic/create_message");
    expect(expr.__args).toHaveLength(1);
  });
});

describe("anthropic: messages.countTokens", () => {
  it("produces anthropic/count_tokens CExpr", () => {
    const expr = api.messages.countTokens({
      model: "claude-sonnet-4-20250514",
      messages: [{ role: "user", content: "Hello" }],
    });
    expect(expr.__kind).toBe("anthropic/count_tokens");
    expect(expr.__args).toHaveLength(1);
  });
});

describe("anthropic: messages.batches.create", () => {
  it("produces anthropic/create_message_batch CExpr", () => {
    const expr = api.messages.batches.create({
      requests: [
        {
          custom_id: "req-1",
          params: {
            model: "claude-sonnet-4-20250514",
            max_tokens: 1024,
            messages: [{ role: "user", content: "Hello" }],
          },
        },
      ],
    });
    expect(expr.__kind).toBe("anthropic/create_message_batch");
    expect(expr.__args).toHaveLength(1);
  });
});

describe("anthropic: messages.batches.retrieve", () => {
  it("produces anthropic/retrieve_message_batch with string id", () => {
    const expr = api.messages.batches.retrieve("msgbatch_123");
    expect(expr.__kind).toBe("anthropic/retrieve_message_batch");
    expect(expr.__args).toHaveLength(1);
    expect(expr.__args[0]).toBe("msgbatch_123");
  });

  it("accepts CExpr id (proxy chained value)", () => {
    const batch = api.messages.batches.retrieve("msgbatch_123");
    const expr = api.messages.batches.retrieve(batch.id);
    expect(expr.__kind).toBe("anthropic/retrieve_message_batch");
    expect(expr.__args).toHaveLength(1);
    const idArg = expr.__args[0] as { __kind: string };
    expect(idArg.__kind).toBe("core/access");
  });
});

describe("anthropic: messages.batches.list", () => {
  it("produces anthropic/list_message_batches CExpr with params", () => {
    const expr = api.messages.batches.list({ limit: 10 });
    expect(expr.__kind).toBe("anthropic/list_message_batches");
    expect(expr.__args).toHaveLength(1);
  });

  it("produces CExpr with no args when omitted", () => {
    const expr = api.messages.batches.list();
    expect(expr.__kind).toBe("anthropic/list_message_batches");
    expect(expr.__args).toHaveLength(0);
  });
});

describe("anthropic: messages.batches.delete", () => {
  it("produces anthropic/delete_message_batch CExpr", () => {
    const expr = api.messages.batches.delete("msgbatch_123");
    expect(expr.__kind).toBe("anthropic/delete_message_batch");
    expect(expr.__args).toHaveLength(1);
    expect(expr.__args[0]).toBe("msgbatch_123");
  });
});

describe("anthropic: messages.batches.cancel", () => {
  it("produces anthropic/cancel_message_batch CExpr", () => {
    const expr = api.messages.batches.cancel("msgbatch_123");
    expect(expr.__kind).toBe("anthropic/cancel_message_batch");
    expect(expr.__args).toHaveLength(1);
    expect(expr.__args[0]).toBe("msgbatch_123");
  });
});

describe("anthropic: models.retrieve", () => {
  it("produces anthropic/retrieve_model CExpr", () => {
    const expr = api.models.retrieve("claude-sonnet-4-20250514");
    expect(expr.__kind).toBe("anthropic/retrieve_model");
    expect(expr.__args).toHaveLength(1);
    expect(expr.__args[0]).toBe("claude-sonnet-4-20250514");
  });
});

describe("anthropic: models.list", () => {
  it("produces anthropic/list_models CExpr with params", () => {
    const expr = api.models.list({ limit: 5 });
    expect(expr.__kind).toBe("anthropic/list_models");
    expect(expr.__args).toHaveLength(1);
  });

  it("produces CExpr with no args when omitted", () => {
    const expr = api.models.list();
    expect(expr.__kind).toBe("anthropic/list_models");
    expect(expr.__args).toHaveLength(0);
  });
});

// ============================================================
// Unified Plugin shape
// ============================================================

describe("anthropic plugin: unified Plugin shape", () => {
  it("has correct name", () => {
    expect(plugin.name).toBe("anthropic");
  });

  it("has 9 node kinds", () => {
    expect(Object.keys(plugin.kinds)).toHaveLength(9);
  });

  it("kinds are all namespaced", () => {
    for (const kind of Object.keys(plugin.kinds)) {
      expect(kind).toMatch(/^anthropic\//);
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

describe("anthropic plugin: factory aliases", () => {
  it("anthropic and anthropicPlugin are the same function", () => {
    expect(anthropic).toBe(anthropicPlugin);
  });
});
