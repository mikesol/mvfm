import { describe, expect, it } from "vitest";
import { app, run, setupMockServer } from "./integration.shared";

setupMockServer();

describe("openai integration: chat completions", () => {
  it("create chat completion", async () => {
    const prog = app(($) =>
      $.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hello" }],
      }),
    );
    const result = (await run(prog)) as any;
    expect(result.object).toBe("chat.completion");
    expect(result.id).toBeDefined();
    expect(result.choices).toBeDefined();
  });

  it("retrieve chat completion", async () => {
    const prog = app(($) => $.openai.chat.completions.retrieve("chatcmpl-mock123"));
    const result = (await run(prog)) as any;
    expect(result.object).toBe("chat.completion");
  });

  it("list chat completions", async () => {
    const prog = app(($) => $.openai.chat.completions.list({ model: "gpt-4o" }));
    const result = (await run(prog)) as any;
    expect(result.object).toBe("list");
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("update chat completion", async () => {
    const prog = app(($) =>
      $.openai.chat.completions.update("chatcmpl-mock123", { metadata: { key: "val" } }),
    );
    const result = (await run(prog)) as any;
    expect(result.object).toBe("chat.completion");
  });

  it("delete chat completion", async () => {
    const prog = app(($) => $.openai.chat.completions.delete("chatcmpl-mock123"));
    const result = (await run(prog)) as any;
    expect(result.deleted).toBe(true);
  });
});
