import { describe, expect, it } from "vitest";
import { app, run, setupMockServer } from "./integration.shared";

setupMockServer();

describe("composition: error + openai", () => {
  it("$.attempt wraps successful openai call", async () => {
    const prog = app(($) =>
      $.attempt(
        $.openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: "Hello" }],
        }),
      ),
    );
    const result = (await run(prog)) as any;
    expect(result.ok).not.toBeNull();
    expect(result.err).toBeNull();
  });
});

describe("composition: fiber + openai", () => {
  it("$.par runs two openai calls in parallel", async () => {
    const prog = app(($) =>
      $.par(
        $.openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: "Hello" }],
        }),
        $.openai.embeddings.create({
          model: "text-embedding-3-small",
          input: "test",
        }),
      ),
    );
    const result = (await run(prog)) as any[];
    expect(result).toHaveLength(2);
    expect(result[0].object).toBe("chat.completion");
    expect(result[1].object).toBe("list");
  });
});
