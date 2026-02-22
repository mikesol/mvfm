import { join } from "node:path";
import { boolPluginU, createApp, defaults, fold, mvfmU, numPluginU, strPluginU } from "@mvfm/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fal as falPlugin } from "../../src/1.9.1";
import { wrapFalSdk } from "../../src/1.9.1/client-fal-sdk";
import { createFalInterpreter } from "../../src/1.9.1/interpreter";
import { createRecordingClient, createReplayClient, type FixtureClient } from "./fixture-client";

const FIXTURE_PATH = join(__dirname, "fixtures/integration.json");
const isRecording = !!process.env.FAL_RECORD;

let client: FixtureClient;

const plugin = falPlugin({ credentials: "fixture" });
const plugins = [numPluginU, strPluginU, boolPluginU, plugin] as const;
const app = createApp(...plugins);

beforeAll(async () => {
  if (isRecording) {
    const { fal } = await import("@fal-ai/client");
    const apiKey = process.env.FAL_API_KEY;
    if (!apiKey) throw new Error("FAL_API_KEY required when FAL_RECORD=1");
    fal.config({ credentials: apiKey });
    client = createRecordingClient(wrapFalSdk(fal), FIXTURE_PATH);
  } else {
    client = createReplayClient(FIXTURE_PATH);
  }
}, 30_000);

afterAll(async () => {
  await client.save();
}, 10_000);

function evaluate(expr: unknown) {
  const _$ = mvfmU(...plugins);
  const nexpr = app(expr as Parameters<typeof app>[0]);
  const interp = defaults(plugins, {
    fal: createFalInterpreter(client),
  });
  return fold(nexpr, interp);
}

describe("fal integration: real API fixtures", () => {
  it("run returns image data", async () => {
    const $ = mvfmU(...plugins);
    const expr = $.fal.run("fal-ai/fast-sdxl", {
      input: { prompt: "a cat sitting on a windowsill" },
    });
    const result = (await evaluate(expr)) as Record<string, unknown>;

    expect(result).toHaveProperty("requestId");
    const data = result.data as Record<string, unknown>;
    expect((data.images as unknown[]).length).toBeGreaterThan(0);
    const img = (data.images as Record<string, unknown>[])[0];
    expect(img).toHaveProperty("url");
    expect(img).toHaveProperty("width");
    expect(img).toHaveProperty("height");
    expect(data.seed).toEqual(expect.any(Number));
  }, 30_000);

  it("subscribe returns image data", async () => {
    const $ = mvfmU(...plugins);
    const expr = $.fal.subscribe("fal-ai/fast-sdxl", {
      input: { prompt: "a dog in a park" },
      mode: "polling" as const,
      pollInterval: 1000,
    });
    const result = (await evaluate(expr)) as Record<string, unknown>;

    expect(result).toHaveProperty("requestId");
    const data = result.data as Record<string, unknown>;
    expect((data.images as unknown[]).length).toBeGreaterThan(0);
    const img = (data.images as Record<string, unknown>[])[0];
    expect(img.url).toEqual(expect.any(String));
  }, 60_000);

  it("queue submit returns queue status", async () => {
    const $ = mvfmU(...plugins);
    const expr = $.fal.queue.submit("fal-ai/fast-sdxl", {
      input: { prompt: "a mountain landscape" },
    });
    const result = (await evaluate(expr)) as Record<string, unknown>;

    expect(result).toHaveProperty("request_id");
    expect(result).toHaveProperty("status", "IN_QUEUE");
    expect(result).toHaveProperty("response_url");
    expect(result).toHaveProperty("status_url");
    expect(result).toHaveProperty("cancel_url");
  }, 30_000);

  it("queue status returns status info", async () => {
    let requestId: string;
    if (isRecording) {
      const submitted = await client.queueSubmit("fal-ai/fast-sdxl", {
        input: { prompt: "status check target" },
      } as Parameters<typeof client.queueSubmit>[1]);
      requestId = (submitted as Record<string, string>).request_id;
      await new Promise((r) => setTimeout(r, 5000));
    } else {
      const { readFileSync } = await import("node:fs");
      const fixtures = JSON.parse(readFileSync(FIXTURE_PATH, "utf-8"));
      const submitEntry = fixtures.find(
        (e: Record<string, unknown>) =>
          e.method === "queueSubmit" &&
          (e.input as Record<string, Record<string, string>>)?.input?.prompt ===
            "status check target",
      );
      requestId = (submitEntry.response as Record<string, string>).request_id;
    }

    const $ = mvfmU(...plugins);
    const expr = $.fal.queue.status("fal-ai/fast-sdxl", { requestId, logs: true });
    const result = (await evaluate(expr)) as Record<string, unknown>;

    expect(["IN_QUEUE", "IN_PROGRESS", "COMPLETED"]).toContain(result.status);
    expect(result).toHaveProperty("request_id");
  }, 30_000);

  it("queue result returns completed data", async () => {
    let requestId: string;
    if (isRecording) {
      const submitted = await client.queueSubmit("fal-ai/fast-sdxl", {
        input: { prompt: "result target" },
      } as Parameters<typeof client.queueSubmit>[1]);
      requestId = (submitted as Record<string, string>).request_id;
      await new Promise((r) => setTimeout(r, 8000));
    } else {
      const { readFileSync } = await import("node:fs");
      const fixtures = JSON.parse(readFileSync(FIXTURE_PATH, "utf-8"));
      const submitEntry = fixtures.find(
        (e: Record<string, unknown>) =>
          e.method === "queueSubmit" &&
          (e.input as Record<string, Record<string, string>>)?.input?.prompt === "result target",
      );
      requestId = (submitEntry.response as Record<string, string>).request_id;
    }

    const $ = mvfmU(...plugins);
    const expr = $.fal.queue.result("fal-ai/fast-sdxl", { requestId });
    const result = (await evaluate(expr)) as Record<string, unknown>;

    expect(result).toHaveProperty("requestId");
    const data = result.data as Record<string, unknown>;
    expect((data.images as unknown[]).length).toBeGreaterThan(0);
  }, 30_000);

  it("queue cancel returns undefined", async () => {
    let requestId: string;
    if (isRecording) {
      const submitted = await client.queueSubmit("fal-ai/fast-sdxl", {
        input: { prompt: "cancel me" },
      } as Parameters<typeof client.queueSubmit>[1]);
      requestId = (submitted as Record<string, string>).request_id;
    } else {
      const { readFileSync } = await import("node:fs");
      const fixtures = JSON.parse(readFileSync(FIXTURE_PATH, "utf-8"));
      const submitEntry = fixtures.find(
        (e: Record<string, unknown>) =>
          e.method === "queueSubmit" &&
          (e.input as Record<string, Record<string, string>>)?.input?.prompt === "cancel me",
      );
      requestId = (submitEntry.response as Record<string, string>).request_id;
    }

    const $ = mvfmU(...plugins);
    const expr = $.fal.queue.cancel("fal-ai/fast-sdxl", { requestId });
    const cancelResult = await evaluate(expr);
    expect(cancelResult).toBeUndefined();
  }, 30_000);
});
