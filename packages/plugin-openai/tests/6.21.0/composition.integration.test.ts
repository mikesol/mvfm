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

describe("composition: error + openai", () => {
  it("$.attempt wraps successful openai call", async () => {
    const prog = app(($) =>
      $.attempt(
        $.openai.chat.completions.create({
          model: "gpt-4o-mini",
          max_tokens: 16,
          messages: [{ role: "user", content: "Say hello in exactly one word." }],
          store: true,
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
          model: "gpt-4o-mini",
          max_tokens: 16,
          messages: [{ role: "user", content: "Say hello in exactly one word." }],
          store: true,
        }),
        $.openai.chat.completions.create({
          model: "gpt-4o-mini",
          max_tokens: 16,
          messages: [{ role: "user", content: "Say hello in exactly one word." }],
          store: true,
        }),
      ),
    );
    const result = (await run(prog)) as any[];
    expect(result).toHaveLength(2);
    expect(result[0].object).toBe("chat.completion");
    expect(result[1].object).toBe("chat.completion");
  });
});
