import * as http from "node:http";
import type { Program } from "@mvfm/core";
import {
  coreInterpreter,
  error,
  errorInterpreter,
  fiber,
  fiberInterpreter,
  injectInput,
  mvfm,
  num,
  numInterpreter,
  str,
  strInterpreter,
} from "@mvfm/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openai as openaiPlugin } from "../../src/6.21.0";
import { serverEvaluate } from "../../src/6.21.0/handler.server";
import type { OpenAIClient } from "../../src/6.21.0/interpreter";

// ---- Lightweight mock OpenAI HTTP server ----

let mockServer: http.Server;
let mockBaseUrl: string;

const MOCK_RESPONSES: Record<string, Record<string, any>> = {
  "POST /chat/completions": {
    id: "chatcmpl-mock123",
    object: "chat.completion",
    model: "gpt-4o",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: "Hello!" },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  },
  "GET /chat/completions/": {
    id: "chatcmpl-mock123",
    object: "chat.completion",
    model: "gpt-4o",
    choices: [],
  },
  "GET /chat/completions": {
    object: "list",
    data: [{ id: "chatcmpl-mock123", object: "chat.completion" }],
  },
  "POST /chat/completions/": {
    id: "chatcmpl-mock123",
    object: "chat.completion",
    model: "gpt-4o",
    choices: [],
  },
  "DELETE /chat/completions/": {
    id: "chatcmpl-mock123",
    object: "chat.completion",
    deleted: true,
  },
  "POST /embeddings": {
    object: "list",
    model: "text-embedding-3-small",
    data: [{ object: "embedding", index: 0, embedding: [0.1, 0.2, 0.3] }],
    usage: { prompt_tokens: 5, total_tokens: 5 },
  },
  "POST /moderations": {
    id: "modr-mock123",
    model: "omni-moderation-latest",
    results: [{ flagged: false, categories: {}, category_scores: {} }],
  },
  "POST /completions": {
    id: "cmpl-mock123",
    object: "text_completion",
    model: "gpt-3.5-turbo-instruct",
    choices: [{ text: "Hello!", index: 0, finish_reason: "stop" }],
    usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
  },
};

function findMockResponse(method: string, url: string): any {
  // Strip query parameters for matching
  const pathOnly = url.split("?")[0];

  // Try exact match first
  const exact = MOCK_RESPONSES[`${method} ${pathOnly}`];
  if (exact) return exact;

  // Try prefix match for resource/{id} patterns
  for (const [key, value] of Object.entries(MOCK_RESPONSES)) {
    const [keyMethod, keyPath] = key.split(" ", 2);
    if (keyMethod === method && keyPath.endsWith("/") && pathOnly.startsWith(keyPath)) {
      return value;
    }
  }

  return null;
}

beforeAll(async () => {
  mockServer = http.createServer((req, res) => {
    let _body = "";
    req.on("data", (chunk) => {
      _body += chunk;
    });
    req.on("end", () => {
      const response = findMockResponse(req.method!, req.url!);
      if (response) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(response));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: `No mock for ${req.method} ${req.url}` }));
      }
    });
  });

  await new Promise<void>((resolve) => {
    mockServer.listen(0, "127.0.0.1", () => {
      const addr = mockServer.address() as { port: number };
      mockBaseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => mockServer.close(() => resolve()));
});

// ---- Build a mock OpenAIClient that hits our mock server ----

function createMockClient(): OpenAIClient {
  return {
    async request(method: string, path: string, body?: Record<string, unknown>) {
      const opts: RequestInit = {
        method: method.toUpperCase(),
        headers: { "Content-Type": "application/json" },
      };
      if (body && method.toUpperCase() === "POST") {
        opts.body = JSON.stringify(body);
      }
      const url =
        method.toUpperCase() === "GET" && body
          ? `${mockBaseUrl}${path}?${new URLSearchParams(Object.entries(body).map(([k, v]) => [k, String(v)])).toString()}`
          : `${mockBaseUrl}${path}`;
      const response = await fetch(url, opts);
      if (!response.ok) {
        throw new Error(`Mock server: ${response.status}`);
      }
      return response.json();
    },
  };
}

const baseInterpreter = {
  ...coreInterpreter,
  ...numInterpreter,
  ...strInterpreter,
  ...errorInterpreter,
  ...fiberInterpreter,
};

const app = mvfm(num, str, openaiPlugin({ apiKey: "sk-test-fake" }), fiber, error);

async function run(prog: Program, input: Record<string, unknown> = {}) {
  const injected = injectInput(prog, input);
  const client = createMockClient();
  const evaluate = serverEvaluate(client, baseInterpreter);
  return await evaluate(injected.ast.result);
}

// ============================================================
// Chat Completions
// ============================================================

describe("openai integration: chat completions", () => {
  it("create chat completion", async () => {
    const prog = app(($) =>
      $.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hello" }],
      }),
    );
    const result = (await run(prog)) as any;
    expect(result.object).toBe("chat.completion");
    expect(result.id).toBeDefined();
    expect(result.choices).toBeDefined();
  });

  it("retrieve chat completion", async () => {
    const prog = app(($) => $.openai.chat.completions.retrieve("chatcmpl-mock123"));
    const result = (await run(prog)) as any;
    expect(result.object).toBe("chat.completion");
  });

  it("list chat completions", async () => {
    const prog = app(($) => $.openai.chat.completions.list({ model: "gpt-4o" }));
    const result = (await run(prog)) as any;
    expect(result.object).toBe("list");
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("update chat completion", async () => {
    const prog = app(($) =>
      $.openai.chat.completions.update("chatcmpl-mock123", { metadata: { key: "val" } }),
    );
    const result = (await run(prog)) as any;
    expect(result.object).toBe("chat.completion");
  });

  it("delete chat completion", async () => {
    const prog = app(($) => $.openai.chat.completions.delete("chatcmpl-mock123"));
    const result = (await run(prog)) as any;
    expect(result.deleted).toBe(true);
  });
});

// ============================================================
// Embeddings
// ============================================================

describe("openai integration: embeddings", () => {
  it("create embedding", async () => {
    const prog = app(($) =>
      $.openai.embeddings.create({
        model: "text-embedding-3-small",
        input: "Hello world",
      }),
    );
    const result = (await run(prog)) as any;
    expect(result.object).toBe("list");
    expect(result.data[0].object).toBe("embedding");
    expect(Array.isArray(result.data[0].embedding)).toBe(true);
  });
});

// ============================================================
// Moderations
// ============================================================

describe("openai integration: moderations", () => {
  it("create moderation", async () => {
    const prog = app(($) =>
      $.openai.moderations.create({
        model: "omni-moderation-latest",
        input: "some text to moderate",
      }),
    );
    const result = (await run(prog)) as any;
    expect(result.results).toBeDefined();
    expect(result.results[0].flagged).toBe(false);
  });
});

// ============================================================
// Legacy Completions
// ============================================================

describe("openai integration: legacy completions", () => {
  it("create completion", async () => {
    const prog = app(($) =>
      $.openai.completions.create({
        model: "gpt-3.5-turbo-instruct",
        prompt: "Say hello",
      }),
    );
    const result = (await run(prog)) as any;
    expect(result.object).toBe("text_completion");
    expect(result.choices[0].text).toBeDefined();
  });
});

// ============================================================
// Composition: error + openai
// ============================================================

describe("composition: error + openai", () => {
  it("$.attempt wraps successful openai call", async () => {
    const prog = app(($) =>
      $.attempt(
        $.openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: "Hello" }],
        }),
      ),
    );
    const result = (await run(prog)) as any;
    expect(result.ok).not.toBeNull();
    expect(result.err).toBeNull();
  });
});

// ============================================================
// Composition: fiber + openai
// ============================================================

describe("composition: fiber + openai", () => {
  it("$.par runs two openai calls in parallel", async () => {
    const prog = app(($) =>
      $.par(
        $.openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: "Hello" }],
        }),
        $.openai.embeddings.create({
          model: "text-embedding-3-small",
          input: "test",
        }),
      ),
    );
    const result = (await run(prog)) as any[];
    expect(result).toHaveLength(2);
    expect(result[0].object).toBe("chat.completion");
    expect(result[1].object).toBe("list");
  });
});

// ============================================================
// Chaining: create completion then use result in moderation
// ============================================================

describe("openai integration: chaining", () => {
  it("create completion then moderate its output", async () => {
    const prog = app(($) => {
      const completion = $.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hello" }],
      });
      return $.openai.moderations.create({
        input: (completion as any).choices,
      });
    });
    const result = (await run(prog)) as any;
    expect(result.results).toBeDefined();
  });
});
