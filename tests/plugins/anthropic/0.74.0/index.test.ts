import { describe, expect, it } from "vitest";
import { mvfm } from "../../../../src/core";
import { anthropic } from "../../../../src/plugins/anthropic/0.74.0";
import { num } from "../../../../src/plugins/num";
import { str } from "../../../../src/plugins/str";

function strip(ast: unknown): unknown {
  return JSON.parse(
    JSON.stringify(ast, (k, v) => (k === "__id" || k === "config" ? undefined : v)),
  );
}

const app = mvfm(num, str, anthropic({ apiKey: "sk-ant-test-123" }));

// ============================================================
// Parity tests: Anthropic plugin AST builder
// ============================================================

describe("anthropic: messages.create", () => {
  it("produces anthropic/create_message node with core/record params", () => {
    const prog = app(($) => {
      return $.anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [{ role: "user", content: "Hello" }],
      });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("anthropic/create_message");
    expect(ast.result.params.kind).toBe("core/record");
    expect(ast.result.params.fields.model.kind).toBe("core/literal");
    expect(ast.result.params.fields.model.value).toBe("claude-sonnet-4-20250514");
    expect(ast.result.params.fields.max_tokens.kind).toBe("core/literal");
    expect(ast.result.params.fields.max_tokens.value).toBe(1024);
  });

  it("accepts Expr params (core/prop_access)", () => {
    const prog = app(($) => {
      return $.anthropic.messages.create({
        model: $.input.model,
        max_tokens: $.input.maxTokens,
        messages: $.input.messages,
      });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("anthropic/create_message");
    expect(ast.result.params.fields.model.kind).toBe("core/prop_access");
    expect(ast.result.params.fields.max_tokens.kind).toBe("core/prop_access");
  });
});

describe("anthropic: messages.countTokens", () => {
  it("produces anthropic/count_tokens node", () => {
    const prog = app(($) => {
      return $.anthropic.messages.countTokens({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hello" }],
      });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("anthropic/count_tokens");
    expect(ast.result.params.kind).toBe("core/record");
    expect(ast.result.params.fields.model.value).toBe("claude-sonnet-4-20250514");
  });
});

describe("anthropic: messages.batches.create", () => {
  it("produces anthropic/create_message_batch node", () => {
    const prog = app(($) => {
      return $.anthropic.messages.batches.create({
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
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("anthropic/create_message_batch");
    expect(ast.result.params.kind).toBe("core/record");
  });
});

describe("anthropic: messages.batches.retrieve", () => {
  it("produces anthropic/retrieve_message_batch with literal id", () => {
    const prog = app(($) => {
      return $.anthropic.messages.batches.retrieve("msgbatch_123");
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("anthropic/retrieve_message_batch");
    expect(ast.result.id.kind).toBe("core/literal");
    expect(ast.result.id.value).toBe("msgbatch_123");
  });

  it("accepts Expr id", () => {
    const prog = app(($) => {
      return $.anthropic.messages.batches.retrieve($.input.batchId);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("anthropic/retrieve_message_batch");
    expect(ast.result.id.kind).toBe("core/prop_access");
  });
});

describe("anthropic: messages.batches.list", () => {
  it("produces anthropic/list_message_batches node with params", () => {
    const prog = app(($) => {
      return $.anthropic.messages.batches.list({ limit: 10 });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("anthropic/list_message_batches");
    expect(ast.result.params.kind).toBe("core/record");
    expect(ast.result.params.fields.limit.value).toBe(10);
  });

  it("optional params are null when omitted", () => {
    const prog = app(($) => {
      return $.anthropic.messages.batches.list();
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("anthropic/list_message_batches");
    expect(ast.result.params).toBeNull();
  });
});

describe("anthropic: messages.batches.delete", () => {
  it("produces anthropic/delete_message_batch node", () => {
    const prog = app(($) => {
      return $.anthropic.messages.batches.delete("msgbatch_123");
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("anthropic/delete_message_batch");
    expect(ast.result.id.kind).toBe("core/literal");
    expect(ast.result.id.value).toBe("msgbatch_123");
  });
});

describe("anthropic: messages.batches.cancel", () => {
  it("produces anthropic/cancel_message_batch node", () => {
    const prog = app(($) => {
      return $.anthropic.messages.batches.cancel("msgbatch_123");
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("anthropic/cancel_message_batch");
    expect(ast.result.id.kind).toBe("core/literal");
    expect(ast.result.id.value).toBe("msgbatch_123");
  });
});

describe("anthropic: models.retrieve", () => {
  it("produces anthropic/retrieve_model node", () => {
    const prog = app(($) => {
      return $.anthropic.models.retrieve("claude-sonnet-4-20250514");
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("anthropic/retrieve_model");
    expect(ast.result.id.kind).toBe("core/literal");
    expect(ast.result.id.value).toBe("claude-sonnet-4-20250514");
  });
});

describe("anthropic: models.list", () => {
  it("produces anthropic/list_models node with params", () => {
    const prog = app(($) => {
      return $.anthropic.models.list({ limit: 5 });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("anthropic/list_models");
    expect(ast.result.params.kind).toBe("core/record");
    expect(ast.result.params.fields.limit.value).toBe(5);
  });

  it("optional params are null when omitted", () => {
    const prog = app(($) => {
      return $.anthropic.models.list();
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("anthropic/list_models");
    expect(ast.result.params).toBeNull();
  });
});

describe("anthropic: integration with $.do()", () => {
  it("side-effecting operations wrapped in $.do() are reachable", () => {
    expect(() => {
      app(($) => {
        const msg = $.anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          messages: [{ role: "user", content: "Hello" }],
        });
        const tokens = $.anthropic.messages.countTokens({
          model: "claude-sonnet-4-20250514",
          messages: [{ role: "user", content: "Hello" }],
        });
        return $.do(msg, tokens);
      });
    }).not.toThrow();
  });
});

describe("anthropic: cross-operation dependencies", () => {
  it("create batch then retrieve by batch.id", () => {
    const prog = app(($) => {
      const batch = $.anthropic.messages.batches.create({
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
      const retrieved = $.anthropic.messages.batches.retrieve(batch.id);
      return $.do(batch, retrieved);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("core/do");
    // The retrieve's id should reference the batch via prop_access
    const retrieveNode = ast.result.result;
    expect(retrieveNode.id.kind).toBe("core/prop_access");
  });
});
