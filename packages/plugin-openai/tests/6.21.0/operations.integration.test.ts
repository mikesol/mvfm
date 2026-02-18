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
import { openai } from "../../src/6.21.0";
import { createOpenAIInterpreter } from "../../src/6.21.0/interpreter";
import { createFixtureClient } from "./fixture-client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureClient = createFixtureClient(join(__dirname, "fixtures"));
const app = mvfm(num, str, openai({ apiKey: "sk-openai-fixture" }), fiber, error);

async function run(prog: Program) {
  const injected = injectInput(prog, {});
  const combined = {
    ...createOpenAIInterpreter(fixtureClient),
    ...errorInterpreter,
    ...fiberInterpreter,
    ...coreInterpreter,
  };
  return await foldAST(combined, injected);
}

describe("openai integration: embeddings", () => {
  it("create_embedding", async () => {
    const prog = app(($) =>
      $.openai.embeddings.create({
        model: "text-embedding-3-small",
        input: "Hello world",
      }),
    );
    const result = (await run(prog)) as any;
    expect(result.object).toBe("list");
    expect(result.model).toContain("text-embedding");
    expect(result.data[0].object).toBe("embedding");
    expect(Array.isArray(result.data[0].embedding)).toBe(true);
    expect(result.data[0].embedding.length).toBeGreaterThan(0);
    expect(result.usage.prompt_tokens).toBe(2);
  });
});

describe("openai integration: moderations", () => {
  it("create_moderation", async () => {
    const prog = app(($) =>
      $.openai.moderations.create({
        model: "omni-moderation-latest",
        input: "This is a test of the moderation endpoint.",
      }),
    );
    const result = (await run(prog)) as any;
    expect(result.id).toMatch(/^modr-/);
    expect(result.model).toBe("omni-moderation-latest");
    expect(result.results).toBeDefined();
    expect(result.results[0].flagged).toBe(false);
  });
});

describe("openai integration: legacy completions", () => {
  it("create_completion", async () => {
    const prog = app(($) =>
      $.openai.completions.create({
        model: "gpt-3.5-turbo-instruct",
        prompt: "Say hello.",
        max_tokens: 16,
      }),
    );
    const result = (await run(prog)) as any;
    expect(result.id).toMatch(/^cmpl-/);
    expect(result.object).toBe("text_completion");
    expect(result.model).toContain("gpt-3.5-turbo-instruct");
    expect(result.choices[0].text).toBeDefined();
    expect(result.choices[0].finish_reason).toBe("stop");
    expect(result.usage.prompt_tokens).toBe(3);
  });
});
