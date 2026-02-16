import type { Program } from "@mvfm/core";
import { coreInterpreter, foldAST, injectInput, mvfm, num, str } from "@mvfm/core";
import { describe, expect, it, vi } from "vitest";
import { anthropicInterpreter } from "../../src";
import { anthropic } from "../../src/0.74.0";
import { type AnthropicClient, createAnthropicInterpreter } from "../../src/0.74.0/interpreter";

const app = mvfm(num, str, anthropic({ apiKey: "sk-ant-test-123" }));

async function run(prog: Program, input: Record<string, unknown> = {}) {
  const captured: any[] = [];
  const injected = injectInput(prog, input);
  const mockClient: AnthropicClient = {
    async request(method, path, params) {
      captured.push({ method, path, params });
      return { id: "mock_id", type: "message", model: "claude-sonnet-4-5-20250929" };
    },
  };
  const combined = { ...createAnthropicInterpreter(mockClient), ...coreInterpreter };
  const result = await foldAST(combined, injected);
  return { result, captured };
}

// ============================================================
// Messages
// ============================================================

describe("anthropic interpreter: create_message", () => {
  it("throws when ANTHROPIC_API_KEY is missing", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const prog = app(($) =>
      $.anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1,
      }),
    );
    const combined = { ...anthropicInterpreter, ...coreInterpreter };
    await expect(foldAST(combined, prog.ast.result)).rejects.toThrow(/ANTHROPIC_API_KEY/);
    vi.unstubAllEnvs();
  });

  it("exports a default ready-to-use interpreter", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test-default");
    expect(typeof anthropicInterpreter["anthropic/create_message"]).toBe("function");
    vi.unstubAllEnvs();
  });

  it("calls POST /v1/messages with correct params", async () => {
    const prog = app(($) =>
      $.anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
      }),
    );
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/v1/messages");
    expect(captured[0].params).toEqual({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
    });
  });
});

describe("anthropic interpreter: count_tokens", () => {
  it("calls POST /v1/messages/count_tokens with correct params", async () => {
    const prog = app(($) =>
      $.anthropic.messages.countTokens({
        model: "claude-sonnet-4-20250514",
        max_tokens: 512,
      }),
    );
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/v1/messages/count_tokens");
    expect(captured[0].params).toEqual({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
    });
  });
});

// ============================================================
// Message Batches
// ============================================================

describe("anthropic interpreter: create_message_batch", () => {
  it("calls POST /v1/messages/batches with correct params", async () => {
    const prog = app(($) =>
      $.anthropic.messages.batches.create({
        batch_name: "test-batch",
        model: "claude-sonnet-4-20250514",
      }),
    );
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/v1/messages/batches");
    expect(captured[0].params).toEqual({
      batch_name: "test-batch",
      model: "claude-sonnet-4-20250514",
    });
  });
});

describe("anthropic interpreter: retrieve_message_batch", () => {
  it("calls GET /v1/messages/batches/{id}", async () => {
    const prog = app(($) => $.anthropic.messages.batches.retrieve("msgbatch_123"));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/v1/messages/batches/msgbatch_123");
    expect(captured[0].params).toBeUndefined();
  });
});

describe("anthropic interpreter: list_message_batches", () => {
  it("calls GET /v1/messages/batches with params", async () => {
    const prog = app(($) => $.anthropic.messages.batches.list({ limit: 10 }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/v1/messages/batches");
    expect(captured[0].params).toEqual({ limit: 10 });
  });

  it("calls GET /v1/messages/batches with undefined params when omitted", async () => {
    const prog = app(($) => $.anthropic.messages.batches.list());
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/v1/messages/batches");
    expect(captured[0].params).toBeUndefined();
  });
});

describe("anthropic interpreter: delete_message_batch", () => {
  it("calls DELETE /v1/messages/batches/{id}", async () => {
    const prog = app(($) => $.anthropic.messages.batches.delete("msgbatch_123"));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("DELETE");
    expect(captured[0].path).toBe("/v1/messages/batches/msgbatch_123");
    expect(captured[0].params).toBeUndefined();
  });
});

describe("anthropic interpreter: cancel_message_batch", () => {
  it("calls POST /v1/messages/batches/{id}/cancel", async () => {
    const prog = app(($) => $.anthropic.messages.batches.cancel("msgbatch_123"));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/v1/messages/batches/msgbatch_123/cancel");
    expect(captured[0].params).toBeUndefined();
  });
});

// ============================================================
// Models
// ============================================================

describe("anthropic interpreter: retrieve_model", () => {
  it("calls GET /v1/models/{id}", async () => {
    const prog = app(($) => $.anthropic.models.retrieve("claude-sonnet-4-20250514"));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/v1/models/claude-sonnet-4-20250514");
    expect(captured[0].params).toBeUndefined();
  });
});

describe("anthropic interpreter: list_models", () => {
  it("calls GET /v1/models with params", async () => {
    const prog = app(($) => $.anthropic.models.list({ limit: 5 }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/v1/models");
    expect(captured[0].params).toEqual({ limit: 5 });
  });

  it("calls GET /v1/models with undefined params when omitted", async () => {
    const prog = app(($) => $.anthropic.models.list());
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/v1/models");
    expect(captured[0].params).toBeUndefined();
  });
});

// ============================================================
// Input resolution
// ============================================================

describe("anthropic interpreter: input resolution", () => {
  it("resolves input params through evaluation", async () => {
    const prog = app({ model: "string", maxTokens: "number" }, ($) =>
      $.anthropic.messages.create({
        model: $.input.model,
        max_tokens: $.input.maxTokens,
      }),
    );
    const { captured } = await run(prog, {
      model: "claude-sonnet-4-5-20250929",
      maxTokens: 2048,
    });
    expect(captured).toHaveLength(1);
    expect(captured[0].params).toEqual({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 2048,
    });
  });

  it("resolves input id for retrieve", async () => {
    const prog = app({ batchId: "string" }, ($) =>
      $.anthropic.messages.batches.retrieve($.input.batchId),
    );
    const { captured } = await run(prog, { batchId: "msgbatch_dynamic_456" });
    expect(captured).toHaveLength(1);
    expect(captured[0].path).toBe("/v1/messages/batches/msgbatch_dynamic_456");
  });
});

// ============================================================
// Mock return value
// ============================================================

describe("anthropic interpreter: return value", () => {
  it("returns the client response as the result", async () => {
    const prog = app(($) => $.anthropic.models.retrieve("claude-sonnet-4-20250514"));
    const { result } = await run(prog);
    expect(result).toEqual({ id: "mock_id", type: "message", model: "claude-sonnet-4-5-20250929" });
  });
});
