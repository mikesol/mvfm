import { boolPluginU, createApp, defaults, fold, mvfmU, numPluginU, strPluginU } from "@mvfm/core";
import { describe, expect, it, vi } from "vitest";
import { falInterpreter } from "../../src";
import { fal } from "../../src/1.9.1";
import { createFalInterpreter, type FalClient } from "../../src/1.9.1/interpreter";

const plugin = fal({ credentials: "key_test_123" });
const plugins = [numPluginU, strPluginU, boolPluginU, plugin] as const;
const $ = mvfmU(...plugins);
const app = createApp(...plugins);

async function run(expr: unknown) {
  const captured: Array<{
    method: string;
    endpointId: string;
    options?: unknown;
  }> = [];
  const mockResponse = {
    data: { images: [{ url: "https://fal.ai/mock.png" }] },
    requestId: "req_mock",
  };
  const mockClient: FalClient = {
    async run(endpointId, options) {
      captured.push({ method: "run", endpointId, options });
      return mockResponse;
    },
    async subscribe(endpointId, options) {
      captured.push({ method: "subscribe", endpointId, options });
      return mockResponse;
    },
    async queueSubmit(endpointId, options) {
      captured.push({ method: "queue_submit", endpointId, options });
      return mockResponse;
    },
    async queueStatus(endpointId, options) {
      captured.push({ method: "queue_status", endpointId, options });
      return { status: "IN_QUEUE" } as ReturnType<FalClient["queueStatus"]> extends Promise<infer T>
        ? T
        : never;
    },
    async queueResult(endpointId, options) {
      captured.push({ method: "queue_result", endpointId, options });
      return mockResponse;
    },
    async queueCancel(endpointId, options) {
      captured.push({ method: "queue_cancel", endpointId, options });
    },
  };
  const nexpr = app(expr as Parameters<typeof app>[0]);
  const interp = defaults(plugins, {
    fal: createFalInterpreter(mockClient),
  });
  const result = await fold(nexpr, interp);
  return { result, captured };
}

// ---- Default interpreter ----

describe("fal interpreter: default export", () => {
  it("throws when FAL_KEY is missing", async () => {
    vi.stubEnv("FAL_KEY", "");
    const expr = $.fal.run("fal-ai/flux/dev", { input: { prompt: "a cat" } });
    const nexpr = app(expr as Parameters<typeof app>[0]);
    const stdInterp = defaults([numPluginU, strPluginU, boolPluginU]);
    const combined = { ...stdInterp, ...falInterpreter };
    await expect(fold(nexpr, combined)).rejects.toThrow(/FAL_KEY/);
    vi.unstubAllEnvs();
  });

  it("exports a default ready-to-use interpreter when FAL_KEY is set", () => {
    vi.stubEnv("FAL_KEY", "key_test_default");
    expect(typeof falInterpreter["fal/run"]).toBe("function");
    vi.unstubAllEnvs();
  });
});

// ---- fal.run ----

describe("fal interpreter: run", () => {
  it("calls client.run with endpointId and full options", async () => {
    const expr = $.fal.run("fal-ai/flux/dev", {
      input: { prompt: "a cat" },
      method: "post",
      startTimeout: 30,
    });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("run");
    expect(captured[0].endpointId).toBe("fal-ai/flux/dev");
    expect(captured[0].options).toEqual({
      input: { prompt: "a cat" },
      method: "post",
      startTimeout: 30,
    });
  });

  it("calls client.run with undefined options when omitted", async () => {
    const expr = $.fal.run("fal-ai/flux/dev");
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].options).toBeUndefined();
  });
});

// ---- fal.subscribe ----

describe("fal interpreter: subscribe", () => {
  it("calls client.subscribe with endpointId and full options", async () => {
    const expr = $.fal.subscribe("fal-ai/flux/dev", {
      input: { prompt: "a cat" },
      mode: "polling",
      logs: true,
    });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("subscribe");
    expect(captured[0].endpointId).toBe("fal-ai/flux/dev");
    expect(captured[0].options).toEqual({
      input: { prompt: "a cat" },
      mode: "polling",
      logs: true,
    });
  });
});

// ---- fal.queue.submit ----

describe("fal interpreter: queue.submit", () => {
  it("calls client.queueSubmit with endpointId and options", async () => {
    const expr = $.fal.queue.submit("fal-ai/flux/dev", {
      input: { prompt: "a cat" },
      priority: "low",
      hint: "gpu",
    });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("queue_submit");
    expect(captured[0].endpointId).toBe("fal-ai/flux/dev");
    expect(captured[0].options).toEqual({
      input: { prompt: "a cat" },
      priority: "low",
      hint: "gpu",
    });
  });
});

// ---- fal.queue.status ----

describe("fal interpreter: queue.status", () => {
  it("calls client.queueStatus with endpointId and options", async () => {
    const expr = $.fal.queue.status("fal-ai/flux/dev", {
      requestId: "req_123",
      logs: true,
    });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("queue_status");
    expect(captured[0].endpointId).toBe("fal-ai/flux/dev");
    expect(captured[0].options).toEqual({ requestId: "req_123", logs: true });
  });
});

// ---- fal.queue.result ----

describe("fal interpreter: queue.result", () => {
  it("calls client.queueResult with endpointId and options", async () => {
    const expr = $.fal.queue.result("fal-ai/flux/dev", { requestId: "req_123" });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("queue_result");
    expect(captured[0].endpointId).toBe("fal-ai/flux/dev");
    expect(captured[0].options).toEqual({ requestId: "req_123" });
  });
});

// ---- fal.queue.cancel ----

describe("fal interpreter: queue.cancel", () => {
  it("calls client.queueCancel with endpointId and options", async () => {
    const expr = $.fal.queue.cancel("fal-ai/flux/dev", { requestId: "req_123" });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("queue_cancel");
    expect(captured[0].endpointId).toBe("fal-ai/flux/dev");
    expect(captured[0].options).toEqual({ requestId: "req_123" });
  });
});

// ---- return value ----

describe("fal interpreter: return value", () => {
  it("returns the client response as the result", async () => {
    const expr = $.fal.run("fal-ai/flux/dev", { input: { prompt: "a cat" } });
    const { result } = await run(expr);
    expect(result).toEqual({
      data: { images: [{ url: "https://fal.ai/mock.png" }] },
      requestId: "req_mock",
    });
  });
});
