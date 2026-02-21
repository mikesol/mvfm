import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defaults, fold } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { createSlackInterpreter } from "../../src/7.14.0/generated/interpreter";
import { createFixtureClient } from "./fixture-client";
import { $, app, plugins } from "./slack.shared";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureClient = createFixtureClient(join(__dirname, "fixtures"));

async function run(expr: unknown) {
  const nexpr = app(expr as Parameters<typeof app>[0]);
  const interp = defaults(plugins, { slack: createSlackInterpreter(fixtureClient) });
  return await fold(nexpr, interp);
}

describe("slack fixture integration", () => {
  it("auth.test returns bot identity", async () => {
    const expr = $.slack.auth.test();
    const result = (await run(expr)) as any;
    expect(result.ok).toBe(true);
    expect(result.user_id).toBeDefined();
    expect(result.team_id).toBeDefined();
  });

  it("conversations.list returns channels", async () => {
    const expr = $.slack.conversations.list({ limit: 5 });
    const result = (await run(expr)) as any;
    expect(result.ok).toBe(true);
    expect(Array.isArray(result.channels)).toBe(true);
  });

  it("users.list returns members", async () => {
    const expr = $.slack.users.list({ limit: 5 });
    const result = (await run(expr)) as any;
    expect(result.ok).toBe(true);
    expect(Array.isArray(result.members)).toBe(true);
  });
});
