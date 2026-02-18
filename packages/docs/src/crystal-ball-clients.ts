/** Crystal-ball mock clients for AI plugin playground examples. */

const CRYSTAL_BALL_REPLIES = [
  "What an interesting bit of text you have there.",
  "Your input made me think.",
  "The stars suggest this is a fine prompt.",
  "I sense great creativity in your words.",
  "The cosmic vibrations align with your request.",
  "A most thought-provoking query indeed.",
  "The oracle has considered your message carefully.",
  "Fascinating — truly fascinating.",
  "The tea leaves confirm: your input is valid.",
  "I gazed into the crystal ball and saw... your prompt.",
];

let crystalBallIndex = 0;
function nextReply(): string {
  const reply = CRYSTAL_BALL_REPLIES[crystalBallIndex % CRYSTAL_BALL_REPLIES.length];
  crystalBallIndex++;
  return reply;
}

// ---- OpenAI crystal-ball client --------------------------------

/** Creates an OpenAI mock client returning prefab crystal-ball responses. */
export function createCrystalBallOpenAIClient(): import("@mvfm/plugin-openai").OpenAIClient {
  return {
    async request(method: string, path: string, _body?: Record<string, unknown>) {
      if (method === "POST" && path === "/chat/completions") {
        return {
          id: "chatcmpl-crystal-ball-001",
          object: "chat.completion",
          created: 1700000000,
          model: "crystal-ball-1",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: nextReply(), refusal: null },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 },
        };
      }
      if (method === "GET" && path.startsWith("/chat/completions/")) {
        return {
          id: path.split("/").pop(),
          object: "chat.completion",
          created: 1700000000,
          model: "crystal-ball-1",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: nextReply() },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 },
          metadata: {},
        };
      }
      if (method === "GET" && path === "/chat/completions") {
        return {
          object: "list",
          data: [
            {
              id: "chatcmpl-crystal-ball-list-001",
              object: "chat.completion",
              created: 1700000000,
              model: "crystal-ball-1",
              choices: [
                {
                  index: 0,
                  message: { role: "assistant", content: nextReply() },
                  finish_reason: "stop",
                },
              ],
              usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 },
            },
          ],
          first_id: "chatcmpl-crystal-ball-list-001",
          last_id: "chatcmpl-crystal-ball-list-001",
          has_more: false,
        };
      }
      if (method === "POST" && path.startsWith("/chat/completions/")) {
        return {
          id: path.split("/").pop(),
          object: "chat.completion",
          created: 1700000000,
          model: "crystal-ball-1",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: nextReply() },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 },
          metadata: { ...(((_body ?? {}) as Record<string, unknown>).metadata as object) },
        };
      }
      if (method === "DELETE" && path.startsWith("/chat/completions/")) {
        return { object: "chat.completion.deleted", id: path.split("/").pop(), deleted: true };
      }
      if (method === "POST" && path === "/embeddings") {
        return {
          object: "list",
          data: [
            { object: "embedding", index: 0, embedding: Array.from({ length: 8 }, () => 0.01) },
          ],
          model: "text-embedding-3-small",
          usage: { prompt_tokens: 3, total_tokens: 3 },
        };
      }
      if (method === "POST" && path === "/moderations") {
        return {
          id: "modr-crystal-ball-001",
          model: "omni-moderation-latest",
          results: [
            {
              flagged: false,
              categories: { harassment: false, sexual: false, hate: false, violence: false },
              category_scores: {
                harassment: 0.0001,
                sexual: 0.0001,
                hate: 0.0001,
                violence: 0.0001,
              },
            },
          ],
        };
      }
      if (method === "POST" && path === "/completions") {
        return {
          id: "cmpl-crystal-ball-001",
          object: "text_completion",
          created: 1700000000,
          model: "crystal-ball-instruct",
          choices: [{ text: nextReply(), index: 0, finish_reason: "stop" }],
          usage: { prompt_tokens: 5, completion_tokens: 8, total_tokens: 13 },
        };
      }
      throw new Error(`Crystal ball OpenAI client: unhandled ${method} ${path}`);
    },
  };
}

// ---- Anthropic crystal-ball client -----------------------------

const BATCH_SHAPE = {
  type: "message_batch" as const,
  processing_status: "in_progress",
  request_counts: { processing: 1, succeeded: 0, errored: 0, canceled: 0, expired: 0 },
  ended_at: null,
  created_at: "2025-01-15T12:00:00Z",
  expires_at: "2025-01-16T12:00:00Z",
  archived_at: null,
  cancel_initiated_at: null,
  results_url: null,
};

/** Creates an Anthropic mock client returning prefab crystal-ball responses. */
export function createCrystalBallAnthropicClient(): import("@mvfm/plugin-anthropic").AnthropicClient {
  return {
    async request(method: string, path: string, _params?: Record<string, unknown>) {
      if (method === "POST" && path === "/v1/messages") {
        return {
          id: "msg-crystal-ball-001",
          type: "message",
          model: "crystal-ball-3-opus",
          role: "assistant",
          content: [{ type: "text", text: nextReply() }],
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 12, output_tokens: 8 },
        };
      }
      if (method === "POST" && path === "/v1/messages/count_tokens") {
        return { input_tokens: 42 };
      }
      if (method === "POST" && path === "/v1/messages/batches") {
        return { id: "msgbatch-crystal-ball-001", ...BATCH_SHAPE };
      }
      if (method === "GET" && /^\/v1\/messages\/batches\/[^/]+$/.test(path)) {
        return { id: path.split("/").pop(), ...BATCH_SHAPE };
      }
      if (method === "GET" && path === "/v1/messages/batches") {
        return {
          data: [{ id: "msgbatch-crystal-ball-001", ...BATCH_SHAPE }],
          has_more: false,
          first_id: "msgbatch-crystal-ball-001",
          last_id: "msgbatch-crystal-ball-001",
        };
      }
      if (method === "DELETE" && path.startsWith("/v1/messages/batches/")) {
        return { id: path.split("/").pop(), type: "message_batch_deleted" };
      }
      if (method === "POST" && path.endsWith("/cancel")) {
        const id = path.split("/").at(-2);
        return {
          id,
          ...BATCH_SHAPE,
          processing_status: "canceling",
          cancel_initiated_at: "2025-01-15T12:05:00Z",
        };
      }
      if (method === "GET" && /^\/v1\/models\/[^/]+$/.test(path)) {
        return {
          type: "model",
          id: path.split("/").pop(),
          display_name: "Crystal Ball 3 Opus",
          created_at: "2025-01-01T00:00:00Z",
        };
      }
      if (method === "GET" && path === "/v1/models") {
        return {
          data: [
            {
              type: "model",
              id: "crystal-ball-3-opus",
              display_name: "Crystal Ball 3 Opus",
              created_at: "2025-01-01T00:00:00Z",
            },
          ],
          has_more: false,
          first_id: "crystal-ball-3-opus",
          last_id: "crystal-ball-3-opus",
        };
      }
      throw new Error(`Crystal ball Anthropic client: unhandled ${method} ${path}`);
    },
  };
}
