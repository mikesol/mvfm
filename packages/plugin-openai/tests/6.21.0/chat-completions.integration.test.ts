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

describe("openai integration: chat completions", () => {
  it("create_chat_completion", async () => {
    const prog = app(($) =>
      $.openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 16,
        messages: [{ role: "user", content: "Say hello in exactly one word." }],
        store: true,
      }),
    );
    const result = (await run(prog)) as any;
    expect(result.object).toBe("chat.completion");
    expect(result.id).toMatch(/^chatcmpl-/);
    expect(result.model).toContain("gpt-4o-mini");
    expect(Array.isArray(result.choices)).toBe(true);
    expect(result.choices[0].message.role).toBe("assistant");
    expect(result.choices[0].message.content).toBe("Hello.");
    expect(result.choices[0].finish_reason).toBe("stop");
    expect(result.usage.prompt_tokens).toBe(14);
    expect(result.usage.completion_tokens).toBe(2);
  });

  // ID-based operations: the fixture client matches by operation name only,
  // not by the actual ID in the path. Contract drift is caught for body-based
  // operations; for ID-based ones we verify the response shape is correct.
  it("retrieve_chat_completion", async () => {
    const prog = app(($) => $.openai.chat.completions.retrieve("chatcmpl_any"));
    const result = (await run(prog)) as any;
    expect(result.object).toBe("chat.completion");
    expect(result.id).toMatch(/^chatcmpl-/);
  });

  it("list_chat_completions", async () => {
    const prog = app(($) => $.openai.chat.completions.list({ limit: 5 }));
    const result = (await run(prog)) as any;
    expect(result.object).toBe("list");
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].object).toBe("chat.completion");
    expect(result.has_more).toBe(false);
  });

  it("update_chat_completion", async () => {
    const prog = app(($) =>
      $.openai.chat.completions.update("chatcmpl_any", { metadata: { fixture: "true" } }),
    );
    const result = (await run(prog)) as any;
    expect(result.object).toBe("chat.completion");
    expect(result.id).toMatch(/^chatcmpl-/);
  });

  it("delete_chat_completion", async () => {
    const prog = app(($) => $.openai.chat.completions.delete("chatcmpl_any"));
    const result = (await run(prog)) as any;
    expect(result.object).toBe("chat.completion.deleted");
    expect(result.deleted).toBe(true);
    expect(result.id).toMatch(/^chatcmpl-/);
  });
});
