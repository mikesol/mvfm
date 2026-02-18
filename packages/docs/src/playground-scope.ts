/** Builds the injected scope for playground code execution. */
export async function createPlaygroundScope(
  fakeConsole: Record<string, (...args: unknown[]) => void>,
  mockInterpreter?: Record<string, unknown>,
  pgliteDb?: unknown,
  redis?: true,
) {
  const core = await import("@mvfm/core");
  const pluginConsole = await import("@mvfm/plugin-console");
  const pluginZod = await import("@mvfm/plugin-zod");
  const { console: _drop, consoleInterpreter: _defaultInterp, ...consoleRest } = pluginConsole;
  const fakeConsoleInterpreter = pluginConsole.createConsoleInterpreter(
    pluginConsole.wrapConsole(fakeConsole as any),
  );
  const realDefaults = core.defaults;
  const realFoldAST = core.foldAST;

  // Group mock handler keys (e.g. "st/let") by plugin name (e.g. "st")
  // so they can be passed as overrides to defaults().
  const mockOverrides: Record<string, Record<string, unknown>> = {};
  if (mockInterpreter) {
    for (const [key, handler] of Object.entries(mockInterpreter)) {
      const pluginName = key.split("/")[0];
      if (!mockOverrides[pluginName]) mockOverrides[pluginName] = {};
      mockOverrides[pluginName][key] = handler;
    }
  }

  // Track the last foldAST return value for display in the playground.
  let lastFoldResult: unknown;

  const pluginFetch = await import("@mvfm/plugin-fetch");
  const pluginPino = await import("@mvfm/plugin-pino");

  // Build a fake pino client that routes log output to fakeConsole
  const fakePinoClient: import("@mvfm/plugin-pino").PinoClient = {
    async log(level, bindings, mergeObject, msg) {
      const parts: unknown[] = [`[pino:${level}]`];
      for (const b of bindings) parts.push(JSON.stringify(b));
      if (mergeObject) parts.push(JSON.stringify(mergeObject));
      if (msg) parts.push(msg);
      fakeConsole.log(...parts);
    },
  };
  const fakePinoInterpreter = pluginPino.createPinoInterpreter(fakePinoClient);

  const pluginOpenAI = await import("@mvfm/plugin-openai");
  const crystalBallOpenAIInterpreter = pluginOpenAI.createOpenAIInterpreter(
    createCrystalBallOpenAIClient(),
  );

  const injected: Record<string, unknown> = {
    ...core,
    console_: pluginConsole.consolePlugin(),
    ...consoleRest,
    zod: pluginZod.zod,
    z: pluginZod.z,
    createZodInterpreter: pluginZod.createZodInterpreter,
    consoleInterpreter: fakeConsoleInterpreter,
    fetch_: pluginFetch.fetch(),
    pino_: pluginPino.pino(),
    createPinoInterpreter: pluginPino.createPinoInterpreter,
    openai_: pluginOpenAI.openai({ apiKey: "sk-crystal-ball" }),
    crystalBallOpenAIInterpreter,
  };

  // Wire PGLite-backed postgres when a db instance is provided
  if (pgliteDb) {
    const pluginPostgres = await import("@mvfm/plugin-postgres");
    const { wrapPgLite } = await import("./pglite-adapter");
    const pg = pluginPostgres.postgres();
    const client = wrapPgLite(pgliteDb as any);
    injected.pg = pg;

    // Build the WASM postgres interpreter eagerly so examples pass it
    // explicitly: defaults(app, { postgres: wasmPgInterpreter })
    const baseInterp: Record<string, unknown> = {
      ...(core.coreInterpreter as any),
      ...fakeConsoleInterpreter,
    };
    injected.wasmPgInterpreter = pluginPostgres.serverInterpreter(client, baseInterp as any);

    injected.defaults = (app: any, ...args: any[]) => {
      const userOverrides = (args[0] ?? {}) as Record<string, unknown>;
      const interp = realDefaults(app, {
        ...mockOverrides,
        ...userOverrides,
      });
      Object.assign(interp, fakeConsoleInterpreter, fakePinoInterpreter);
      return interp;
    };
  } else {
    injected.defaults = (app: any, ...args: any[]) => {
      const userOverrides = (args[0] ?? {}) as Record<string, unknown>;
      const merged = { ...mockOverrides, ...userOverrides };
      const interp = realDefaults(app, merged);
      Object.assign(interp, fakeConsoleInterpreter, fakePinoInterpreter);
      return interp;
    };
  }

  // Wire in-memory Redis when redis flag is set
  if (redis) {
    const { MemoryRedisClient } = await import("./memory-redis-client");
    const pluginRedis = await import("@mvfm/plugin-redis");
    const client = new MemoryRedisClient();
    injected.redis = pluginRedis.redis();
    injected.memoryRedisInterpreter = pluginRedis.createRedisInterpreter(client);
  }

  injected.foldAST = async (...args: any[]) => {
    const result = await (realFoldAST as any)(...args);
    lastFoldResult = result;
    return result;
  };

  return {
    paramNames: ["console", ...Object.keys(injected)],
    paramValues: [fakeConsole, ...Object.values(injected)],
    get lastFoldResult() {
      return lastFoldResult;
    },
  };
}

// ---- Crystal-ball OpenAI mock client -------------------------

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
function nextCrystalBallReply(): string {
  const reply = CRYSTAL_BALL_REPLIES[crystalBallIndex % CRYSTAL_BALL_REPLIES.length];
  crystalBallIndex++;
  return reply;
}

function createCrystalBallOpenAIClient(): import("@mvfm/plugin-openai").OpenAIClient {
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
              message: { role: "assistant", content: nextCrystalBallReply(), refusal: null },
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
              message: { role: "assistant", content: nextCrystalBallReply() },
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
                  message: { role: "assistant", content: nextCrystalBallReply() },
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
              message: { role: "assistant", content: nextCrystalBallReply() },
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
          choices: [{ text: nextCrystalBallReply(), index: 0, finish_reason: "stop" }],
          usage: { prompt_tokens: 5, completion_tokens: 8, total_tokens: 13 },
        };
      }
      throw new Error(`Crystal ball client: unhandled ${method} ${path}`);
    },
  };
}
