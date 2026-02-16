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
import { afterAll, beforeAll } from "vitest";
import { openai as openaiPlugin } from "../../src/6.21.0";
import { serverEvaluate } from "../../src/6.21.0/handler.server";
import type { OpenAIClient } from "../../src/6.21.0/interpreter";

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
  const pathOnly = url.split("?")[0];
  const exact = MOCK_RESPONSES[`${method} ${pathOnly}`];
  if (exact) return exact;

  for (const [key, value] of Object.entries(MOCK_RESPONSES)) {
    const [keyMethod, keyPath] = key.split(" ", 2);
    if (keyMethod === method && keyPath.endsWith("/") && pathOnly.startsWith(keyPath)) {
      return value;
    }
  }

  return null;
}

export function setupMockServer(): void {
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
}

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

export async function run(prog: Program, input: Record<string, unknown> = {}): Promise<unknown> {
  const injected = injectInput(prog, input);
  const client = createMockClient();
  const evaluate = serverEvaluate(client, baseInterpreter);
  return await evaluate(injected.ast.result);
}

export { app };
