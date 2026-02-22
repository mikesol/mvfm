import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { boolPluginU, createApp, defaults, fold, mvfmU, numPluginU, strPluginU } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { anthropic } from "../../src/0.74.0";
import { createAnthropicInterpreter } from "../../src/0.74.0/interpreter";
import { createFixtureClient } from "./fixture-client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureClient = createFixtureClient(join(__dirname, "fixtures"));
const plugin = anthropic({ apiKey: "sk-ant-fixture" });
const plugins = [numPluginU, strPluginU, boolPluginU, plugin] as const;
const $ = mvfmU(...plugins);
const app = createApp(...plugins);

async function run(expr: unknown) {
  const nexpr = app(expr as Parameters<typeof app>[0]);
  const interp = defaults(plugins, {
    anthropic: createAnthropicInterpreter(fixtureClient),
  });
  return await fold(nexpr, interp);
}

// ============================================================
// Messages
// ============================================================

describe("anthropic integration: messages", () => {
  it("create_message", async () => {
    const expr = $.anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 16,
      messages: [{ role: "user", content: "Say hello in exactly one word." }],
    });
    const result = (await run(expr)) as Record<string, unknown>;
    expect(result.type).toBe("message");
    expect(result.role).toBe("assistant");
    expect(result.id).toMatch(/^msg_/);
    expect(result.model).toBe("claude-sonnet-4-20250514");
    expect(Array.isArray(result.content)).toBe(true);
    const content = result.content as Array<Record<string, unknown>>;
    expect(content[0].type).toBe("text");
    expect(content[0].text).toBe("Hello.");
    expect(result.stop_reason).toBe("end_turn");
    const usage = result.usage as Record<string, unknown>;
    expect(usage.input_tokens).toBe(14);
    expect(usage.output_tokens).toBe(5);
  });

  it("count_tokens", async () => {
    const expr = $.anthropic.messages.countTokens({
      model: "claude-sonnet-4-20250514",
      messages: [{ role: "user", content: "Hello" }],
    });
    const result = (await run(expr)) as Record<string, unknown>;
    expect(result.input_tokens).toBe(8);
  });
});

// ============================================================
// Batches
// ============================================================

describe("anthropic integration: batches", () => {
  it("create_message_batch", async () => {
    const expr = $.anthropic.messages.batches.create({
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
    });
    const result = (await run(expr)) as Record<string, unknown>;
    expect(result.id).toMatch(/^msgbatch_/);
    expect(result.type).toBe("message_batch");
    expect(result.processing_status).toBe("in_progress");
  });

  it("retrieve_message_batch", async () => {
    const expr = $.anthropic.messages.batches.retrieve("msgbatch_any");
    const result = (await run(expr)) as Record<string, unknown>;
    expect(result.id).toMatch(/^msgbatch_/);
    expect(result.type).toBe("message_batch");
    expect(result.processing_status).toBe("in_progress");
  });

  it("list_message_batches", async () => {
    const expr = $.anthropic.messages.batches.list({ limit: 10 });
    const result = (await run(expr)) as Record<string, unknown>;
    expect(Array.isArray(result.data)).toBe(true);
    const data = result.data as Array<Record<string, unknown>>;
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].type).toBe("message_batch");
    expect(result.has_more).toBe(false);
  });

  it("cancel_message_batch", async () => {
    const expr = $.anthropic.messages.batches.cancel("msgbatch_any");
    const result = (await run(expr)) as Record<string, unknown>;
    expect(result.type).toBe("message_batch");
    expect(result.processing_status).toBe("canceling");
  });

  it("delete_message_batch", async () => {
    const expr = $.anthropic.messages.batches.delete("msgbatch_any");
    const result = (await run(expr)) as Record<string, unknown>;
    expect(result.type).toBe("message_batch_deleted");
    expect(result.id).toMatch(/^msgbatch_/);
  });
});

// ============================================================
// Models
// ============================================================

describe("anthropic integration: models", () => {
  it("retrieve_model", async () => {
    const expr = $.anthropic.models.retrieve("claude-sonnet-4-20250514");
    const result = (await run(expr)) as Record<string, unknown>;
    expect(result.type).toBe("model");
    expect(result.id).toBe("claude-sonnet-4-20250514");
    expect(result.display_name).toBe("Claude Sonnet 4");
  });

  it("list_models", async () => {
    const expr = $.anthropic.models.list({ limit: 5 });
    const result = (await run(expr)) as Record<string, unknown>;
    expect(Array.isArray(result.data)).toBe(true);
    const data = result.data as Array<Record<string, unknown>>;
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].type).toBe("model");
    expect(data[0].id).toBeDefined();
    expect(data[0].display_name).toBeDefined();
    expect(result.has_more).toBe(true);
  });
});
