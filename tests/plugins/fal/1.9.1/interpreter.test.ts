import { describe, expect, it } from "vitest";
import { foldAST, mvfm } from "../../../../src/core";
import { coreInterpreter } from "../../../../src/interpreters/core";
import { fal } from "../../../../src/plugins/fal/1.9.1";
import { falInterpreter } from "../../../../src/plugins/fal/1.9.1/interpreter";
import { num } from "../../../../src/plugins/num";
import { str } from "../../../../src/plugins/str";

const app = mvfm(num, str, fal({ credentials: "key_test_123" }));
const fragments = [falInterpreter, coreInterpreter];

function injectInput(node: any, input: Record<string, unknown>): any {
  if (node === null || node === undefined || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map((n) => injectInput(n, input));
  const result: any = {};
  for (const [k, v] of Object.entries(node)) {
    result[k] = injectInput(v, input);
  }
  if (result.kind === "core/input") result.__inputData = input;
  return result;
}

async function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const captured: any[] = [];
  const ast = injectInput(prog.ast, input);
  const recurse = foldAST(fragments, {
    "fal/api_call": async (effect) => {
      captured.push(effect);
      return { data: { images: [{ url: "https://fal.ai/mock.png" }] }, requestId: "req_mock" };
    },
    "fal/subscribe": async (effect) => {
      captured.push(effect);
      return { data: { images: [{ url: "https://fal.ai/mock.png" }] }, requestId: "req_mock" };
    },
  });
  const result = await recurse(ast.result);
  return { result, captured };
}

// ---- fal.run ----

describe("fal interpreter: run", () => {
  it("yields fal/api_call with endpointId and input", async () => {
    const prog = app(($) => $.fal.run("fal-ai/flux/dev", { input: { prompt: "a cat" } }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("fal/api_call");
    expect(captured[0].endpointId).toBe("fal-ai/flux/dev");
    expect(captured[0].method).toBe("run");
    expect(captured[0].input).toEqual({ prompt: "a cat" });
  });

  it("yields fal/api_call with undefined input when omitted", async () => {
    const prog = app(($) => $.fal.run("fal-ai/flux/dev"));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].input).toBeUndefined();
  });
});

// ---- fal.subscribe ----

describe("fal interpreter: subscribe", () => {
  it("yields fal/subscribe with endpointId and input", async () => {
    const prog = app(($) => $.fal.subscribe("fal-ai/flux/dev", { input: { prompt: "a cat" } }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("fal/subscribe");
    expect(captured[0].endpointId).toBe("fal-ai/flux/dev");
    expect(captured[0].input).toEqual({ prompt: "a cat" });
  });
});

// ---- fal.queue.submit ----

describe("fal interpreter: queue.submit", () => {
  it("yields fal/api_call with method queue_submit", async () => {
    const prog = app(($) => $.fal.queue.submit("fal-ai/flux/dev", { input: { prompt: "a cat" } }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("fal/api_call");
    expect(captured[0].endpointId).toBe("fal-ai/flux/dev");
    expect(captured[0].method).toBe("queue_submit");
    expect(captured[0].input).toEqual({ prompt: "a cat" });
  });
});

// ---- fal.queue.status ----

describe("fal interpreter: queue.status", () => {
  it("yields fal/api_call with method queue_status and requestId", async () => {
    const prog = app(($) => $.fal.queue.status("fal-ai/flux/dev", { requestId: "req_123" }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("fal/api_call");
    expect(captured[0].endpointId).toBe("fal-ai/flux/dev");
    expect(captured[0].method).toBe("queue_status");
    expect(captured[0].requestId).toBe("req_123");
  });
});

// ---- fal.queue.result ----

describe("fal interpreter: queue.result", () => {
  it("yields fal/api_call with method queue_result and requestId", async () => {
    const prog = app(($) => $.fal.queue.result("fal-ai/flux/dev", { requestId: "req_123" }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("fal/api_call");
    expect(captured[0].endpointId).toBe("fal-ai/flux/dev");
    expect(captured[0].method).toBe("queue_result");
    expect(captured[0].requestId).toBe("req_123");
  });
});

// ---- fal.queue.cancel ----

describe("fal interpreter: queue.cancel", () => {
  it("yields fal/api_call with method queue_cancel and requestId", async () => {
    const prog = app(($) => $.fal.queue.cancel("fal-ai/flux/dev", { requestId: "req_123" }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("fal/api_call");
    expect(captured[0].endpointId).toBe("fal-ai/flux/dev");
    expect(captured[0].method).toBe("queue_cancel");
    expect(captured[0].requestId).toBe("req_123");
  });
});

// ---- input resolution ----

describe("fal interpreter: input resolution", () => {
  it("resolves input params through recurse", async () => {
    const prog = app({ prompt: "string" }, ($) =>
      $.fal.run("fal-ai/flux/dev", { input: { prompt: $.input.prompt } }),
    );
    const { captured } = await run(prog, { prompt: "a dog" });
    expect(captured).toHaveLength(1);
    expect(captured[0].input).toEqual({ prompt: "a dog" });
  });

  it("resolves dynamic requestId through recurse", async () => {
    const prog = app({ reqId: "string" }, ($) =>
      $.fal.queue.status("fal-ai/flux/dev", { requestId: $.input.reqId }),
    );
    const { captured } = await run(prog, { reqId: "req_dynamic_456" });
    expect(captured).toHaveLength(1);
    expect(captured[0].requestId).toBe("req_dynamic_456");
  });
});

// ---- return value ----

describe("fal interpreter: return value", () => {
  it("returns the handler response as the result", async () => {
    const prog = app(($) => $.fal.run("fal-ai/flux/dev", { input: { prompt: "a cat" } }));
    const { result } = await run(prog);
    expect(result).toEqual({
      data: { images: [{ url: "https://fal.ai/mock.png" }] },
      requestId: "req_mock",
    });
  });
});
