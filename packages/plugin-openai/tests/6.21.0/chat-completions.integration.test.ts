import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { boolPluginU, createApp, defaults, fold, mvfmU, numPluginU, strPluginU } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { openai } from "../../src/6.21.0";
import { createOpenAIInterpreter } from "../../src/6.21.0/interpreter";
import { createFixtureClient } from "./fixture-client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureClient = createFixtureClient(join(__dirname, "fixtures"));
const plugin = openai({ apiKey: "sk-openai-fixture" });
const plugins = [numPluginU, strPluginU, boolPluginU, plugin] as const;
const $ = mvfmU(...plugins);
const app = createApp(...plugins);

async function run(expr: unknown) {
  const nexpr = app(expr as Parameters<typeof app>[0]);
  const interp = defaults(plugins, {
    openai: createOpenAIInterpreter(fixtureClient),
  });
  return await fold(nexpr, interp);
}

describe("openai integration: chat completions", () => {
  it("create_chat_completion", async () => {
    const expr = $.openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 16,
      messages: [{ role: "user", content: "Say hello in exactly one word." }],
      store: true,
    });
    const result = (await run(expr)) as Record<string, unknown>;
    expect(result.object).toBe("chat.completion");
    expect(result.id).toMatch(/^chatcmpl-/);
    expect(result.model).toContain("gpt-4o-mini");
    expect(Array.isArray(result.choices)).toBe(true);
    const choices = result.choices as Array<Record<string, unknown>>;
    const msg = choices[0].message as Record<string, unknown>;
    expect(msg.role).toBe("assistant");
    expect(msg.content).toBe("Hello.");
    expect(choices[0].finish_reason).toBe("stop");
    const usage = result.usage as Record<string, unknown>;
    expect(usage.prompt_tokens).toBe(14);
    expect(usage.completion_tokens).toBe(2);
  });

  it("retrieve_chat_completion", async () => {
    const expr = $.openai.chat.completions.retrieve("chatcmpl_any");
    const result = (await run(expr)) as Record<string, unknown>;
    expect(result.object).toBe("chat.completion");
    expect(result.id).toMatch(/^chatcmpl-/);
  });

  it("list_chat_completions", async () => {
    const expr = $.openai.chat.completions.list({ limit: 5 });
    const result = (await run(expr)) as Record<string, unknown>;
    expect(result.object).toBe("list");
    expect(Array.isArray(result.data)).toBe(true);
    const data = result.data as Array<Record<string, unknown>>;
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].object).toBe("chat.completion");
    expect(result.has_more).toBe(false);
  });

  it("update_chat_completion", async () => {
    const expr = $.openai.chat.completions.update("chatcmpl_any", {
      metadata: { fixture: "true" },
    });
    const result = (await run(expr)) as Record<string, unknown>;
    expect(result.object).toBe("chat.completion");
    expect(result.id).toMatch(/^chatcmpl-/);
  });

  it("delete_chat_completion", async () => {
    const expr = $.openai.chat.completions.delete("chatcmpl_any");
    const result = (await run(expr)) as Record<string, unknown>;
    expect(result.object).toBe("chat.completion.deleted");
    expect(result.deleted).toBe(true);
    expect(result.id).toMatch(/^chatcmpl-/);
  });
});
