import { describe, expect, it } from "vitest";
import { foldAST, mvfm } from "../../../../src/core";
import { coreInterpreter } from "../../../../src/interpreters/core";
import { anthropic } from "../../../../src/plugins/anthropic/0.74.0";
import { anthropicInterpreter } from "../../../../src/plugins/anthropic/0.74.0/interpreter";
import { num } from "../../../../src/plugins/num";
import { str } from "../../../../src/plugins/str";

const app = mvfm(num, str, anthropic({ apiKey: "sk-ant-test-123" }));
const fragments = [anthropicInterpreter, coreInterpreter];

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
    "anthropic/api_call": async (effect) => {
      captured.push(effect);
      return { id: "mock_id", type: "message", model: "claude-sonnet-4-5-20250929" };
    },
  });
  const result = await recurse(ast.result);
  return { result, captured };
}

// ============================================================
// Messages
// ============================================================

describe("anthropic interpreter: create_message", () => {
  it("yields POST /v1/messages with correct params", async () => {
    const prog = app(($) =>
      $.anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
      }),
    );
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("anthropic/api_call");
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/v1/messages");
    expect(captured[0].params).toEqual({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
    });
  });
});

describe("anthropic interpreter: count_tokens", () => {
  it("yields POST /v1/messages/count_tokens with correct params", async () => {
    const prog = app(($) =>
      $.anthropic.messages.countTokens({
        model: "claude-sonnet-4-20250514",
        max_tokens: 512,
      }),
    );
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("anthropic/api_call");
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
  it("yields POST /v1/messages/batches with correct params", async () => {
    const prog = app(($) =>
      $.anthropic.messages.batches.create({
        batch_name: "test-batch",
        model: "claude-sonnet-4-20250514",
      }),
    );
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("anthropic/api_call");
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/v1/messages/batches");
    expect(captured[0].params).toEqual({
      batch_name: "test-batch",
      model: "claude-sonnet-4-20250514",
    });
  });
});

describe("anthropic interpreter: retrieve_message_batch", () => {
  it("yields GET /v1/messages/batches/{id}", async () => {
    const prog = app(($) => $.anthropic.messages.batches.retrieve("msgbatch_123"));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("anthropic/api_call");
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/v1/messages/batches/msgbatch_123");
    expect(captured[0].params).toBeUndefined();
  });
});

describe("anthropic interpreter: list_message_batches", () => {
  it("yields GET /v1/messages/batches with params", async () => {
    const prog = app(($) => $.anthropic.messages.batches.list({ limit: 10 }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("anthropic/api_call");
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/v1/messages/batches");
    expect(captured[0].params).toEqual({ limit: 10 });
  });

  it("yields GET /v1/messages/batches with undefined params when omitted", async () => {
    const prog = app(($) => $.anthropic.messages.batches.list());
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/v1/messages/batches");
    expect(captured[0].params).toBeUndefined();
  });
});

describe("anthropic interpreter: delete_message_batch", () => {
  it("yields DELETE /v1/messages/batches/{id}", async () => {
    const prog = app(($) => $.anthropic.messages.batches.delete("msgbatch_123"));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("anthropic/api_call");
    expect(captured[0].method).toBe("DELETE");
    expect(captured[0].path).toBe("/v1/messages/batches/msgbatch_123");
    expect(captured[0].params).toBeUndefined();
  });
});

describe("anthropic interpreter: cancel_message_batch", () => {
  it("yields POST /v1/messages/batches/{id}/cancel", async () => {
    const prog = app(($) => $.anthropic.messages.batches.cancel("msgbatch_123"));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("anthropic/api_call");
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/v1/messages/batches/msgbatch_123/cancel");
    expect(captured[0].params).toBeUndefined();
  });
});

// ============================================================
// Models
// ============================================================

describe("anthropic interpreter: retrieve_model", () => {
  it("yields GET /v1/models/{id}", async () => {
    const prog = app(($) => $.anthropic.models.retrieve("claude-sonnet-4-20250514"));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("anthropic/api_call");
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/v1/models/claude-sonnet-4-20250514");
    expect(captured[0].params).toBeUndefined();
  });
});

describe("anthropic interpreter: list_models", () => {
  it("yields GET /v1/models with params", async () => {
    const prog = app(($) => $.anthropic.models.list({ limit: 5 }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("anthropic/api_call");
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/v1/models");
    expect(captured[0].params).toEqual({ limit: 5 });
  });

  it("yields GET /v1/models with undefined params when omitted", async () => {
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
  it("resolves input params through recurse", async () => {
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
  it("returns the handler response as the result", async () => {
    const prog = app(($) => $.anthropic.models.retrieve("claude-sonnet-4-20250514"));
    const { result } = await run(prog);
    expect(result).toEqual({ id: "mock_id", type: "message", model: "claude-sonnet-4-5-20250929" });
  });
});
