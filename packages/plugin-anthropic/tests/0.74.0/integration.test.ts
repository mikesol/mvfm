import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Program } from "@mvfm/core";
import {
  coreInterpreter,
  error,
  errorInterpreter,
  fiber,
  fiberInterpreter,
  foldAST,
  injectInput,
  mvfm,
  num,
  str,
} from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { anthropic } from "../../src/0.74.0";
import { createAnthropicInterpreter } from "../../src/0.74.0/interpreter";
import { createFixtureClient } from "./fixture-client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureClient = createFixtureClient(join(__dirname, "fixtures"));
const app = mvfm(num, str, anthropic({ apiKey: "sk-ant-fixture" }), fiber, error);

async function run(prog: Program) {
  const injected = injectInput(prog, {});
  const combined = {
    ...createAnthropicInterpreter(fixtureClient),
    ...errorInterpreter,
    ...fiberInterpreter,
    ...coreInterpreter,
  };
  return await foldAST(combined, injected);
}

// ============================================================
// Messages
// ============================================================

describe("anthropic integration: messages", () => {
  it("create_message", async () => {
    const prog = app(($) =>
      $.anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 16,
        messages: [{ role: "user", content: "Say hello in exactly one word." }],
      }),
    );
    const result = (await run(prog)) as any;
    expect(result.type).toBe("message");
    expect(result.role).toBe("assistant");
    expect(result.id).toMatch(/^msg_/);
    expect(result.model).toBe("claude-sonnet-4-20250514");
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toBe("Hello.");
    expect(result.stop_reason).toBe("end_turn");
    expect(result.usage.input_tokens).toBe(14);
    expect(result.usage.output_tokens).toBe(5);
  });

  it("count_tokens", async () => {
    const prog = app(($) =>
      $.anthropic.messages.countTokens({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hello" }],
      }),
    );
    const result = (await run(prog)) as any;
    expect(result.input_tokens).toBe(8);
  });
});

// ============================================================
// Batches
// ============================================================

describe("anthropic integration: batches", () => {
  it("create_message_batch", async () => {
    const prog = app(($) =>
      $.anthropic.messages.batches.create({
        requests: [
          {
            custom_id: "fixture-req-001",
            params: {
              model: "claude-sonnet-4-20250514",
              max_tokens: 16,
              messages: [{ role: "user", content: "Say hi." }],
            },
          },
        ],
      }),
    );
    const result = (await run(prog)) as any;
    expect(result.id).toMatch(/^msgbatch_/);
    expect(result.type).toBe("message_batch");
    expect(result.processing_status).toBe("in_progress");
  });

  // ID-based operations: the fixture client matches by operation name only,
  // not by the actual ID in the path. Contract drift is caught for param-based
  // operations; for ID-based ones we verify the response shape is correct.
  it("retrieve_message_batch", async () => {
    const prog = app(($) => $.anthropic.messages.batches.retrieve("msgbatch_any"));
    const result = (await run(prog)) as any;
    expect(result.id).toMatch(/^msgbatch_/);
    expect(result.type).toBe("message_batch");
    expect(result.processing_status).toBe("in_progress");
  });

  it("list_message_batches", async () => {
    const prog = app(($) => $.anthropic.messages.batches.list({ limit: 10 }));
    const result = (await run(prog)) as any;
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].type).toBe("message_batch");
    expect(result.has_more).toBe(false);
  });

  it("cancel_message_batch", async () => {
    const prog = app(($) => $.anthropic.messages.batches.cancel("msgbatch_any"));
    const result = (await run(prog)) as any;
    expect(result.type).toBe("message_batch");
    expect(result.processing_status).toBe("canceling");
  });

  it("delete_message_batch", async () => {
    const prog = app(($) => $.anthropic.messages.batches.delete("msgbatch_any"));
    const result = (await run(prog)) as any;
    expect(result.type).toBe("message_batch_deleted");
    expect(result.id).toMatch(/^msgbatch_/);
  });
});

// ============================================================
// Models
// ============================================================

describe("anthropic integration: models", () => {
  it("retrieve_model", async () => {
    const prog = app(($) => $.anthropic.models.retrieve("claude-sonnet-4-20250514"));
    const result = (await run(prog)) as any;
    expect(result.type).toBe("model");
    expect(result.id).toBe("claude-sonnet-4-20250514");
    expect(result.display_name).toBe("Claude Sonnet 4");
  });

  it("list_models", async () => {
    const prog = app(($) => $.anthropic.models.list({ limit: 5 }));
    const result = (await run(prog)) as any;
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].type).toBe("model");
    expect(result.data[0].id).toBeDefined();
    expect(result.data[0].display_name).toBeDefined();
    expect(result.has_more).toBe(true);
  });
});

// ============================================================
// Composition: error + anthropic
// ============================================================

describe("composition: error + anthropic", () => {
  it("$.attempt wraps successful call", async () => {
    const prog = app(($) =>
      $.attempt(
        $.anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 16,
          messages: [{ role: "user", content: "Say hello in exactly one word." }],
        }),
      ),
    );
    const result = (await run(prog)) as any;
    expect(result.ok).not.toBeNull();
    expect(result.err).toBeNull();
  });
});

// ============================================================
// Composition: fiber + anthropic
// ============================================================

describe("composition: fiber + anthropic", () => {
  it("$.par runs two calls in parallel", async () => {
    const prog = app(($) =>
      $.par(
        $.anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 16,
          messages: [{ role: "user", content: "Say hello in exactly one word." }],
        }),
        $.anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 16,
          messages: [{ role: "user", content: "Say hello in exactly one word." }],
        }),
      ),
    );
    const result = (await run(prog)) as any[];
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe("message");
    expect(result[1].type).toBe("message");
  });
});
