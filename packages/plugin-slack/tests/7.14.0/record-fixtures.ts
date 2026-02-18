/**
 * Record Slack API fixtures from real API.
 *
 * Usage: npx tsx tests/7.14.0/record-fixtures.ts
 *
 * Reads SLACK_TOKEN from the monorepo root .env file.
 * NOT run in CI — only when fixtures need refreshing.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Fixture } from "./fixture-client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MONOREPO_ROOT = resolve(__dirname, "../../../..");
const FIXTURES_DIR = resolve(__dirname, "fixtures");

function loadToken(): string {
  const envPath = resolve(MONOREPO_ROOT, ".env");
  const contents = readFileSync(envPath, "utf-8");
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const eqIdx = trimmed.indexOf("=");
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (key === "SLACK_BOT_TOKEN" || key === "SLACK_TOKEN") return value;
  }
  throw new Error(`SLACK_BOT_TOKEN or SLACK_TOKEN not found in ${envPath}`);
}

function save(name: string, fixture: Fixture): void {
  const filePath = resolve(FIXTURES_DIR, `${name}.json`);
  writeFileSync(filePath, `${JSON.stringify(fixture, null, 2)}\n`);
  console.log(`  saved ${name}.json`);
}

async function main(): Promise<void> {
  const token = loadToken();
  const { WebClient } = await import("@slack/web-api");
  const web = new WebClient(token);

  mkdirSync(FIXTURES_DIR, { recursive: true });
  console.log("Recording Slack API fixtures...\n");

  // 1. auth.test — identity check, always safe
  console.log("[auth.test]");
  const authResponse = await web.apiCall("auth.test", {});
  save("auth_test", {
    request: { method: "auth.test" },
    response: authResponse,
  });

  // 2. conversations.list — read-only
  console.log("[conversations.list]");
  const convParams = { limit: 5 };
  const convResponse = await web.apiCall("conversations.list", convParams);
  save("conversations_list", {
    request: { method: "conversations.list", params: convParams },
    response: convResponse,
  });

  // 3. users.list — read-only
  console.log("[users.list]");
  const usersParams = { limit: 5 };
  const usersResponse = await web.apiCall("users.list", usersParams);
  save("users_list", {
    request: { method: "users.list", params: usersParams },
    response: usersResponse,
  });

  console.log("\nDone! Fixtures saved to tests/7.14.0/fixtures/");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
