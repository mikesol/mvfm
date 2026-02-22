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

describe("openai integration: embeddings", () => {
  it("create_embedding", async () => {
    const expr = $.openai.embeddings.create({
      model: "text-embedding-3-small",
      input: "Hello world",
    });
    const result = (await run(expr)) as Record<string, unknown>;
    expect(result.object).toBe("list");
    expect(result.model).toContain("text-embedding");
    const data = result.data as Array<Record<string, unknown>>;
    expect(data[0].object).toBe("embedding");
    expect(Array.isArray(data[0].embedding)).toBe(true);
    expect((data[0].embedding as unknown[]).length).toBeGreaterThan(0);
    const usage = result.usage as Record<string, unknown>;
    expect(usage.prompt_tokens).toBe(2);
  });
});

describe("openai integration: moderations", () => {
  it("create_moderation", async () => {
    const expr = $.openai.moderations.create({
      model: "omni-moderation-latest",
      input: "This is a test of the moderation endpoint.",
    });
    const result = (await run(expr)) as Record<string, unknown>;
    expect(result.id).toMatch(/^modr-/);
    expect(result.model).toBe("omni-moderation-latest");
    expect(result.results).toBeDefined();
    const results = result.results as Array<Record<string, unknown>>;
    expect(results[0].flagged).toBe(false);
  });
});

describe("openai integration: legacy completions", () => {
  it("create_completion", async () => {
    const expr = $.openai.completions.create({
      model: "gpt-3.5-turbo-instruct",
      prompt: "Say hello.",
      max_tokens: 16,
    });
    const result = (await run(expr)) as Record<string, unknown>;
    expect(result.id).toMatch(/^cmpl-/);
    expect(result.object).toBe("text_completion");
    expect(result.model).toContain("gpt-3.5-turbo-instruct");
    const choices = result.choices as Array<Record<string, unknown>>;
    expect(choices[0].text).toBeDefined();
    expect(choices[0].finish_reason).toBe("stop");
    const usage = result.usage as Record<string, unknown>;
    expect(usage.prompt_tokens).toBe(3);
  });
});
