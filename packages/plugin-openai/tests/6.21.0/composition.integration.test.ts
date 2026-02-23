import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  boolPlugin,
  composeDollar,
  createApp,
  defaults,
  fold,
  numPlugin,
  strPlugin,
} from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { openai } from "../../src/6.21.0";
import { createOpenAIInterpreter } from "../../src/6.21.0/interpreter";
import { createFixtureClient } from "./fixture-client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureClient = createFixtureClient(join(__dirname, "fixtures"));
const plugin = openai({ apiKey: "sk-openai-fixture" });
const plugins = [numPlugin, strPlugin, boolPlugin, plugin] as const;
const $ = composeDollar(...plugins);
const app = createApp(...plugins);

async function run(expr: unknown) {
  const nexpr = app(expr);
  const interp = defaults(plugins, {
    openai: createOpenAIInterpreter(fixtureClient),
  });
  return await fold(nexpr, interp);
}

describe("composition: basic openai pipeline", () => {
  it("create chat completion returns expected structure", async () => {
    const expr = $.openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 16,
      messages: [{ role: "user", content: "Say hello in exactly one word." }],
      store: true,
    });
    const result = (await run(expr)) as Record<string, unknown>;
    expect(result.object).toBe("chat.completion");
    expect(result.id).toMatch(/^chatcmpl-/);
  });
});
