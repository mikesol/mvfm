import { mvfm, num, str } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { openai } from "../../src/6.21.0";

function strip(ast: unknown): unknown {
  return JSON.parse(
    JSON.stringify(ast, (k, v) => (k === "__id" || k === "config" ? undefined : v)),
  );
}

const app = mvfm(num, str, openai({ apiKey: "sk-test-123" }));

// ============================================================
// Chat Completions
// ============================================================

describe("openai: chat.completions.create", () => {
  it("produces openai/create_chat_completion node", () => {
    const prog = app(($) => {
      return $.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hello" }],
      });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("openai/create_chat_completion");
    expect(ast.result.params.kind).toBe("core/record");
  });

  it("accepts Expr params and captures proxy dependencies", () => {
    const prog = app(($) => {
      return $.openai.chat.completions.create({
        model: $.input.model,
        messages: $.input.messages,
      });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("openai/create_chat_completion");
    expect(ast.result.params.fields.model.kind).toBe("core/prop_access");
  });
});

describe("openai: chat.completions.retrieve", () => {
  it("produces openai/retrieve_chat_completion node with literal id", () => {
    const prog = app(($) => {
      return $.openai.chat.completions.retrieve("cmpl_123");
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("openai/retrieve_chat_completion");
    expect(ast.result.id.kind).toBe("core/literal");
    expect(ast.result.id.value).toBe("cmpl_123");
  });

  it("accepts Expr<string> id", () => {
    const prog = app(($) => {
      return $.openai.chat.completions.retrieve($.input.completionId);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.id.kind).toBe("core/prop_access");
  });
});

describe("openai: chat.completions.list", () => {
  it("produces openai/list_chat_completions node with params", () => {
    const prog = app(($) => {
      return $.openai.chat.completions.list({ model: "gpt-4o", limit: 10 });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("openai/list_chat_completions");
    expect(ast.result.params.kind).toBe("core/record");
  });

  it("optional params are null when omitted", () => {
    const prog = app(($) => {
      return $.openai.chat.completions.list();
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("openai/list_chat_completions");
    expect(ast.result.params).toBeNull();
  });
});

describe("openai: chat.completions.update", () => {
  it("produces openai/update_chat_completion node", () => {
    const prog = app(($) => {
      return $.openai.chat.completions.update("cmpl_123", { metadata: { key: "value" } });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("openai/update_chat_completion");
    expect(ast.result.id.kind).toBe("core/literal");
    expect(ast.result.id.value).toBe("cmpl_123");
    expect(ast.result.params.kind).toBe("core/record");
  });
});

describe("openai: chat.completions.delete", () => {
  it("produces openai/delete_chat_completion node", () => {
    const prog = app(($) => {
      return $.openai.chat.completions.delete("cmpl_123");
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("openai/delete_chat_completion");
    expect(ast.result.id.kind).toBe("core/literal");
    expect(ast.result.id.value).toBe("cmpl_123");
  });
});

// ============================================================
// Embeddings
// ============================================================

describe("openai: embeddings.create", () => {
  it("produces openai/create_embedding node", () => {
    const prog = app(($) => {
      return $.openai.embeddings.create({
        model: "text-embedding-3-small",
        input: "Hello world",
      });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("openai/create_embedding");
    expect(ast.result.params.kind).toBe("core/record");
  });
});

// ============================================================
// Moderations
// ============================================================

describe("openai: moderations.create", () => {
  it("produces openai/create_moderation node", () => {
    const prog = app(($) => {
      return $.openai.moderations.create({
        model: "omni-moderation-latest",
        input: "some text to moderate",
      });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("openai/create_moderation");
    expect(ast.result.params.kind).toBe("core/record");
  });
});

// ============================================================
// Legacy Completions
// ============================================================

describe("openai: completions.create", () => {
  it("produces openai/create_completion node", () => {
    const prog = app(($) => {
      return $.openai.completions.create({
        model: "gpt-3.5-turbo-instruct",
        prompt: "Say hello",
      });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("openai/create_completion");
    expect(ast.result.params.kind).toBe("core/record");
  });
});

// ============================================================
// Integration with $.discard() and cross-operation dependencies
// ============================================================

describe("openai: integration with $.discard()", () => {
  it("side-effecting operations wrapped in $.discard() are reachable", () => {
    expect(() => {
      app(($) => {
        const completion = $.openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: "Hello" }],
        });
        const embedding = $.openai.embeddings.create({
          model: "text-embedding-3-small",
          input: "Hello world",
        });
        return $.discard(completion, embedding);
      });
    }).not.toThrow();
  });
});

describe("openai: cross-operation dependencies", () => {
  it("can use result of one operation as input to another", () => {
    const prog = app(($) => {
      const completion = $.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hello" }],
      });
      const moderation = $.openai.moderations.create({
        input: (completion as any).choices,
      });
      return $.discard(completion, moderation);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("core/discard");
  });
});
