import { describe, expect, it } from "vitest";
import { ilo } from "../../../../src/core";
import { fal } from "../../../../src/plugins/fal/1.9.1";
import { num } from "../../../../src/plugins/num";
import { str } from "../../../../src/plugins/str";

function strip(ast: unknown): unknown {
  return JSON.parse(
    JSON.stringify(ast, (k, v) => (k === "__id" || k === "config" ? undefined : v)),
  );
}

const app = ilo(num, str, fal({ credentials: "key_test_123" }));

// ---- fal.run ----

describe("fal: run", () => {
  it("produces fal/run node with literal input", () => {
    const prog = app(($) => {
      return $.fal.run("fal-ai/flux/dev", { input: { prompt: "a cat" } });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("fal/run");
    expect(ast.result.endpointId.kind).toBe("core/literal");
    expect(ast.result.endpointId.value).toBe("fal-ai/flux/dev");
    expect(ast.result.input.kind).toBe("core/record");
    expect(ast.result.input.fields.prompt.value).toBe("a cat");
  });

  it("accepts Expr input values", () => {
    const prog = app(($) => {
      return $.fal.run("fal-ai/flux/dev", { input: { prompt: $.input.prompt } });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("fal/run");
    expect(ast.result.input.fields.prompt.kind).toBe("core/prop_access");
  });

  it("optional options are null when omitted", () => {
    const prog = app(($) => {
      return $.fal.run("fal-ai/flux/dev");
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("fal/run");
    expect(ast.result.input).toBeNull();
  });
});

// ---- fal.subscribe ----

describe("fal: subscribe", () => {
  it("produces fal/subscribe node", () => {
    const prog = app(($) => {
      return $.fal.subscribe("fal-ai/flux/dev", { input: { prompt: "a cat" } });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("fal/subscribe");
    expect(ast.result.endpointId.kind).toBe("core/literal");
    expect(ast.result.input.kind).toBe("core/record");
  });
});

// ---- fal.queue.submit ----

describe("fal: queue.submit", () => {
  it("produces fal/queue_submit node", () => {
    const prog = app(($) => {
      return $.fal.queue.submit("fal-ai/flux/dev", { input: { prompt: "a cat" } });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("fal/queue_submit");
    expect(ast.result.endpointId.kind).toBe("core/literal");
    expect(ast.result.input.kind).toBe("core/record");
  });
});

// ---- fal.queue.status ----

describe("fal: queue.status", () => {
  it("produces fal/queue_status node with literal requestId", () => {
    const prog = app(($) => {
      return $.fal.queue.status("fal-ai/flux/dev", { requestId: "req_123" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("fal/queue_status");
    expect(ast.result.endpointId.kind).toBe("core/literal");
    expect(ast.result.requestId.kind).toBe("core/literal");
    expect(ast.result.requestId.value).toBe("req_123");
  });

  it("accepts Expr requestId from queue.submit result", () => {
    const prog = app(($) => {
      const queued = $.fal.queue.submit("fal-ai/flux/dev", { input: { prompt: "a cat" } });
      return $.fal.queue.status("fal-ai/flux/dev", { requestId: queued.request_id });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("fal/queue_status");
    expect(ast.result.requestId.kind).toBe("core/prop_access");
  });
});

// ---- fal.queue.result ----

describe("fal: queue.result", () => {
  it("produces fal/queue_result node", () => {
    const prog = app(($) => {
      return $.fal.queue.result("fal-ai/flux/dev", { requestId: "req_123" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("fal/queue_result");
    expect(ast.result.endpointId.kind).toBe("core/literal");
    expect(ast.result.requestId.kind).toBe("core/literal");
  });
});

// ---- fal.queue.cancel ----

describe("fal: queue.cancel", () => {
  it("produces fal/queue_cancel node", () => {
    const prog = app(($) => {
      return $.fal.queue.cancel("fal-ai/flux/dev", { requestId: "req_123" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("fal/queue_cancel");
    expect(ast.result.endpointId.kind).toBe("core/literal");
    expect(ast.result.requestId.kind).toBe("core/literal");
  });
});

// ---- cross-operation dependencies ----

describe("fal: cross-operation dependencies", () => {
  it("can chain queue.submit result into queue.result", () => {
    const prog = app(($) => {
      const queued = $.fal.queue.submit("fal-ai/flux/dev", { input: { prompt: "a cat" } });
      return $.fal.queue.result("fal-ai/flux/dev", { requestId: queued.request_id });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("fal/queue_result");
    expect(ast.result.requestId.kind).toBe("core/prop_access");
  });
});
