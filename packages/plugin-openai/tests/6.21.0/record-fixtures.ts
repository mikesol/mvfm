/**
 * Record API fixtures from the real OpenAI API.
 *
 * Usage: npx tsx tests/6.21.0/record-fixtures.ts
 *
 * Reads OPENAI_API_KEY from the monorepo root .env file.
 * Saves request/response pairs as JSON in tests/6.21.0/fixtures/.
 *
 * NOT run in CI — only when fixtures need refreshing.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import { wrapOpenAISdk } from "../../src/6.21.0/client-openai-sdk";
import type { Fixture } from "./fixture-client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MONOREPO_ROOT = resolve(__dirname, "../../../..");
const FIXTURES_DIR = resolve(__dirname, "fixtures");

function loadApiKey(): string {
  const envPath = resolve(MONOREPO_ROOT, ".env");
  const contents = readFileSync(envPath, "utf-8");
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const eqIdx = trimmed.indexOf("=");
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (key === "OPENAI_API_KEY") return value;
  }
  throw new Error(`OPENAI_API_KEY not found in ${envPath}`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function save(name: string, fixture: Fixture): void {
  const filePath = resolve(FIXTURES_DIR, `${name}.json`);
  writeFileSync(
    filePath,
    `${JSON.stringify({ request: fixture.request, response: fixture.response }, null, 2)}\n`,
  );
  console.log(`  saved ${name}.json`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const apiKey = loadApiKey();
  const sdk = new OpenAI({ apiKey });
  const client = wrapOpenAISdk(sdk);

  mkdirSync(FIXTURES_DIR, { recursive: true });

  console.log("Recording OpenAI API fixtures...\n");

  // === Chat Completions ===

  console.log("[chat completions]");

  const createChatBody = {
    model: "gpt-4o-mini",
    max_tokens: 16,
    messages: [{ role: "user", content: "Say hello in exactly one word." }],
    store: true,
  };
  const createChatResponse = await client.request("POST", "/chat/completions", createChatBody);
  save("create_chat_completion", {
    request: { method: "POST", path: "/chat/completions", body: createChatBody },
    response: createChatResponse,
  });

  const chatId = (createChatResponse as { id: string }).id;
  console.log(`  chat completion id: ${chatId}`);

  // Stored completions may not be immediately available for retrieval
  console.log("  waiting for stored completion to become available...");
  await sleep(3000);

  const retrieveChatResponse = await client.request("GET", `/chat/completions/${chatId}`);
  save("retrieve_chat_completion", {
    request: { method: "GET", path: `/chat/completions/${chatId}` },
    response: retrieveChatResponse,
  });

  const listChatBody = { limit: 5 };
  const listChatResponse = await client.request("GET", "/chat/completions", listChatBody);
  save("list_chat_completions", {
    request: { method: "GET", path: "/chat/completions", body: listChatBody },
    response: listChatResponse,
  });

  const updateChatBody = { metadata: { fixture: "true" } };
  const updateChatResponse = await client.request(
    "POST",
    `/chat/completions/${chatId}`,
    updateChatBody,
  );
  save("update_chat_completion", {
    request: { method: "POST", path: `/chat/completions/${chatId}`, body: updateChatBody },
    response: updateChatResponse,
  });

  const deleteChatResponse = await client.request("DELETE", `/chat/completions/${chatId}`);
  save("delete_chat_completion", {
    request: { method: "DELETE", path: `/chat/completions/${chatId}` },
    response: deleteChatResponse,
  });

  // === Embeddings ===

  console.log("\n[embeddings]");

  const createEmbeddingBody = {
    model: "text-embedding-3-small",
    input: "Hello world",
  };
  const createEmbeddingResponse = await client.request("POST", "/embeddings", createEmbeddingBody);
  save("create_embedding", {
    request: { method: "POST", path: "/embeddings", body: createEmbeddingBody },
    response: createEmbeddingResponse,
  });

  // === Moderations ===

  console.log("\n[moderations]");

  const createModerationBody = {
    model: "omni-moderation-latest",
    input: "This is a test of the moderation endpoint.",
  };
  const createModerationResponse = await client.request(
    "POST",
    "/moderations",
    createModerationBody,
  );
  save("create_moderation", {
    request: { method: "POST", path: "/moderations", body: createModerationBody },
    response: createModerationResponse,
  });

  // === Legacy Completions ===

  console.log("\n[legacy completions]");

  const createCompletionBody = {
    model: "gpt-3.5-turbo-instruct",
    prompt: "Say hello.",
    max_tokens: 16,
  };
  const createCompletionResponse = await client.request(
    "POST",
    "/completions",
    createCompletionBody,
  );
  save("create_completion", {
    request: { method: "POST", path: "/completions", body: createCompletionBody },
    response: createCompletionResponse,
  });

  console.log("\nDone! Fixtures saved to tests/6.21.0/fixtures/");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
