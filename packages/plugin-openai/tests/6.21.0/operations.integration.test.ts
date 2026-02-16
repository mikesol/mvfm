import { describe, expect, it } from "vitest";
import { app, run, setupMockServer } from "./integration.shared";

setupMockServer();

describe("openai integration: embeddings", () => {
  it("create embedding", async () => {
    const prog = app(($) =>
      $.openai.embeddings.create({
        model: "text-embedding-3-small",
        input: "Hello world",
      }),
    );
    const result = (await run(prog)) as any;
    expect(result.object).toBe("list");
    expect(result.data[0].object).toBe("embedding");
    expect(Array.isArray(result.data[0].embedding)).toBe(true);
  });
});

describe("openai integration: moderations", () => {
  it("create moderation", async () => {
    const prog = app(($) =>
      $.openai.moderations.create({
        model: "omni-moderation-latest",
        input: "some text to moderate",
      }),
    );
    const result = (await run(prog)) as any;
    expect(result.results).toBeDefined();
    expect(result.results[0].flagged).toBe(false);
  });
});

describe("openai integration: legacy completions", () => {
  it("create completion", async () => {
    const prog = app(($) =>
      $.openai.completions.create({
        model: "gpt-3.5-turbo-instruct",
        prompt: "Say hello",
      }),
    );
    const result = (await run(prog)) as any;
    expect(result.object).toBe("text_completion");
    expect(result.choices[0].text).toBeDefined();
  });
});

describe("openai integration: chaining", () => {
  it("create completion then moderate its output", async () => {
    const prog = app(($) => {
      const completion = $.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hello" }],
      });
      return $.openai.moderations.create({
        input: (completion as any).choices,
      });
    });
    const result = (await run(prog)) as any;
    expect(result.results).toBeDefined();
  });
});
