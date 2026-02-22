/**
 * Record API fixtures from the real Anthropic API.
 *
 * Usage: npx tsx tests/0.74.0/record-fixtures.ts
 *
 * Reads ANTHROPIC_API_KEY from the monorepo root .env file.
 * Saves request/response pairs as JSON in tests/0.74.0/fixtures/.
 *
 * NOT run in CI — only when fixtures need refreshing.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { wrapAnthropicSdk } from "../../src/0.74.0/client-anthropic-sdk";
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
    if (key === "ANTHROPIC_API_KEY") return value;
  }
  throw new Error(`ANTHROPIC_API_KEY not found in ${envPath}`);
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
  const sdk = new Anthropic({ apiKey });
  const client = wrapAnthropicSdk(sdk);

  mkdirSync(FIXTURES_DIR, { recursive: true });

  console.log("Recording Anthropic API fixtures...\n");

  // === Messages ===

  console.log("[messages]");

  const createMessageParams = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 16,
    messages: [{ role: "user", content: "Say hello in exactly one word." }],
  };
  const createMessageResponse = await client.request("POST", "/v1/messages", createMessageParams);
  save("create_message", {
    request: { method: "POST", path: "/v1/messages", params: createMessageParams },
    response: createMessageResponse,
  });

  const countTokensParams = {
    model: "claude-sonnet-4-20250514",
    messages: [{ role: "user", content: "Hello" }],
  };
  const countTokensResponse = await client.request(
    "POST",
    "/v1/messages/count_tokens",
    countTokensParams,
  );
  save("count_tokens", {
    request: { method: "POST", path: "/v1/messages/count_tokens", params: countTokensParams },
    response: countTokensResponse,
  });

  // === Batches (sequenced) ===

  console.log("\n[batches]");

  const createBatchParams = {
    requests: [
      {
        custom_id: "fixture-req-001",
        params: {
          model: "claude-sonnet-4-20250514",
          max_tokens: 16,
          messages: [{ role: "user", content: "Say hi." }],
        },
      },
    ],
  };
  const createBatchResponse = await client.request(
    "POST",
    "/v1/messages/batches",
    createBatchParams,
  );
  save("create_message_batch", {
    request: { method: "POST", path: "/v1/messages/batches", params: createBatchParams },
    response: createBatchResponse,
  });

  const batchId = (createBatchResponse as { id: string }).id;
  console.log(`  batch id: ${batchId}`);

  const retrieveBatchResponse = await client.request("GET", `/v1/messages/batches/${batchId}`);
  save("retrieve_message_batch", {
    request: { method: "GET", path: `/v1/messages/batches/${batchId}` },
    response: retrieveBatchResponse,
  });

  const listBatchesParams = { limit: 10 };
  const listBatchesResponse = await client.request(
    "GET",
    "/v1/messages/batches",
    listBatchesParams,
  );
  save("list_message_batches", {
    request: { method: "GET", path: "/v1/messages/batches", params: listBatchesParams },
    response: listBatchesResponse,
  });

  const cancelBatchResponse = await client.request(
    "POST",
    `/v1/messages/batches/${batchId}/cancel`,
  );
  save("cancel_message_batch", {
    request: { method: "POST", path: `/v1/messages/batches/${batchId}/cancel` },
    response: cancelBatchResponse,
  });

  // Poll until batch reaches terminal state before deleting
  console.log("  polling batch status...");
  const terminalStates = new Set(["canceled", "ended", "expired"]);
  let batchStatus = "";
  while (!terminalStates.has(batchStatus)) {
    await sleep(2000);
    const poll = (await client.request("GET", `/v1/messages/batches/${batchId}`)) as {
      processing_status: string;
    };
    batchStatus = poll.processing_status;
    console.log(`    status: ${batchStatus}`);
  }

  const deleteBatchResponse = await client.request("DELETE", `/v1/messages/batches/${batchId}`);
  save("delete_message_batch", {
    request: { method: "DELETE", path: `/v1/messages/batches/${batchId}` },
    response: deleteBatchResponse,
  });

  // === Models ===

  console.log("\n[models]");

  const retrieveModelResponse = await client.request("GET", "/v1/models/claude-sonnet-4-20250514");
  save("retrieve_model", {
    request: { method: "GET", path: "/v1/models/claude-sonnet-4-20250514" },
    response: retrieveModelResponse,
  });

  const listModelsParams = { limit: 5 };
  const listModelsResponse = await client.request("GET", "/v1/models", listModelsParams);
  save("list_models", {
    request: { method: "GET", path: "/v1/models", params: listModelsParams },
    response: listModelsResponse,
  });

  console.log("\nDone! Fixtures saved to tests/0.74.0/fixtures/");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
