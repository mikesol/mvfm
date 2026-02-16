import { coreInterpreter, injectInput, mvfm, num, str } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { fal as falPlugin } from "../../src/1.9.1";
import { serverEvaluate } from "../../src/1.9.1/handler.server";

function createClient() {
  const calls: Array<{ method: string; endpointId: string; options?: unknown }> = [];

  const client = {
    async run(endpointId: string, options?: unknown) {
      calls.push({ method: "run", endpointId, options });
      return { data: { ok: true }, requestId: "req_run" };
    },
    async subscribe(endpointId: string, options?: unknown) {
      calls.push({ method: "subscribe", endpointId, options });
      return { data: { ok: true }, requestId: "req_sub" };
    },
    async queueSubmit(endpointId: string, options: unknown) {
      calls.push({ method: "queue_submit", endpointId, options });
      return {
        status: "IN_QUEUE",
        request_id: "req_submit",
        response_url: "https://example.com/response",
        status_url: "https://example.com/status",
        cancel_url: "https://example.com/cancel",
        queue_position: 1,
      };
    },
    async queueStatus(endpointId: string, options: unknown) {
      calls.push({ method: "queue_status", endpointId, options });
      return {
        status: "IN_PROGRESS",
        request_id: "req_status",
        response_url: "https://example.com/response",
        status_url: "https://example.com/status",
        cancel_url: "https://example.com/cancel",
        logs: [],
      };
    },
    async queueResult(endpointId: string, options: unknown) {
      calls.push({ method: "queue_result", endpointId, options });
      return { data: { imageUrl: "https://example.com/image.png" }, requestId: "req_result" };
    },
    async queueCancel(endpointId: string, options: unknown) {
      calls.push({ method: "queue_cancel", endpointId, options });
    },
  };

  return { client, calls };
}

describe("fal integration: options passthrough", () => {
  it("passes run options through server handler", async () => {
    const app = mvfm(num, str, falPlugin({ credentials: "key_test_123" }));
    const prog = app(($) =>
      $.fal.run("fal-ai/flux/dev", {
        input: { prompt: "a cat" },
        method: "post",
        startTimeout: 25,
      }),
    );

    const injected = injectInput(prog, {});
    const { client, calls } = createClient();
    const evaluate = serverEvaluate(client, coreInterpreter);
    const result = await evaluate(injected.ast.result);

    expect(result).toEqual({ data: { ok: true }, requestId: "req_run" });
    expect(calls).toEqual([
      {
        method: "run",
        endpointId: "fal-ai/flux/dev",
        options: { input: { prompt: "a cat" }, method: "post", startTimeout: 25 },
      },
    ]);
  });

  it("passes subscribe options through server handler", async () => {
    const app = mvfm(num, str, falPlugin({ credentials: "key_test_123" }));
    const prog = app(($) =>
      $.fal.subscribe("fal-ai/flux/dev", {
        input: { prompt: "a cat" },
        mode: "polling",
        logs: true,
      }),
    );

    const injected = injectInput(prog, {});
    const { client, calls } = createClient();
    const evaluate = serverEvaluate(client, coreInterpreter);
    const result = await evaluate(injected.ast.result);

    expect(result).toEqual({ data: { ok: true }, requestId: "req_sub" });
    expect(calls[0]).toEqual({
      method: "subscribe",
      endpointId: "fal-ai/flux/dev",
      options: { input: { prompt: "a cat" }, mode: "polling", logs: true },
    });
  });

  it("passes queue submit/status/result/cancel options through server handler", async () => {
    const app = mvfm(num, str, falPlugin({ credentials: "key_test_123" }));

    const submitProg = app(($) =>
      $.fal.queue.submit("fal-ai/flux/dev", {
        input: { prompt: "a cat" },
        priority: "low",
        hint: "gpu",
      }),
    );
    const statusProg = app(($) =>
      $.fal.queue.status("fal-ai/flux/dev", { requestId: "req_123", logs: true }),
    );
    const resultProg = app(($) => $.fal.queue.result("fal-ai/flux/dev", { requestId: "req_123" }));
    const cancelProg = app(($) => $.fal.queue.cancel("fal-ai/flux/dev", { requestId: "req_123" }));

    const { client, calls } = createClient();
    const evaluate = serverEvaluate(client, coreInterpreter);

    await evaluate(injectInput(submitProg, {}).ast.result);
    await evaluate(injectInput(statusProg, {}).ast.result);
    const result = await evaluate(injectInput(resultProg, {}).ast.result);
    const cancelResult = await evaluate(injectInput(cancelProg, {}).ast.result);

    expect(result).toEqual({
      data: { imageUrl: "https://example.com/image.png" },
      requestId: "req_result",
    });
    expect(cancelResult).toBeUndefined();
    expect(calls).toEqual([
      {
        method: "queue_submit",
        endpointId: "fal-ai/flux/dev",
        options: { input: { prompt: "a cat" }, priority: "low", hint: "gpu" },
      },
      {
        method: "queue_status",
        endpointId: "fal-ai/flux/dev",
        options: { requestId: "req_123", logs: true },
      },
      {
        method: "queue_result",
        endpointId: "fal-ai/flux/dev",
        options: { requestId: "req_123" },
      },
      {
        method: "queue_cancel",
        endpointId: "fal-ai/flux/dev",
        options: { requestId: "req_123" },
      },
    ]);
  });
});
