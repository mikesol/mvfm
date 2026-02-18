import {
  createCrystalBallAnthropicClient,
  createCrystalBallFalClient,
  createCrystalBallOpenAIClient,
  createCrystalBallResendClient,
  createCrystalBallStripeClient,
} from "./crystal-ball-clients";

/** Builds the injected scope for playground code execution. */
export async function createPlaygroundScope(
  fakeConsole: Record<string, (...args: unknown[]) => void>,
  mockInterpreter?: Record<string, unknown>,
  pgliteDb?: unknown,
  redis?: true,
  s3?: true,
  cloudflareKv?: true,
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

  const pluginSlack = await import("@mvfm/plugin-slack");

  const pluginOpenAI = await import("@mvfm/plugin-openai");
  const crystalBallOpenAIInterpreter = pluginOpenAI.createOpenAIInterpreter(
    createCrystalBallOpenAIClient(),
  );

  const pluginAnthropic = await import("@mvfm/plugin-anthropic");
  const crystalBallAnthropicInterpreter = pluginAnthropic.createAnthropicInterpreter(
    createCrystalBallAnthropicClient(),
  );

  const pluginFal = await import("@mvfm/plugin-fal");
  const crystalBallFalInterpreter = pluginFal.createFalInterpreter(createCrystalBallFalClient());

  const pluginStripe = await import("@mvfm/plugin-stripe");
  const crystalBallStripeInterpreter = pluginStripe.createStripeInterpreter(
    createCrystalBallStripeClient(),
  );

  const pluginResend = await import("@mvfm/plugin-resend");
  const crystalBallResendInterpreter = pluginResend.createResendInterpreter(
    createCrystalBallResendClient(),
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
    anthropic_: pluginAnthropic.anthropic({ apiKey: "sk-ant-crystal-ball" }),
    crystalBallAnthropicInterpreter,
    fal_: pluginFal.fal({ credentials: "key-crystal-ball" }),
    crystalBallFalInterpreter,

    stripe_: pluginStripe.stripe({ apiKey: "sk_test_crystal_ball" }),
    crystalBallStripeInterpreter,
    slack_: pluginSlack.slack({ token: "xoxb-mock-token" }),

    resend_: pluginResend.resend({ apiKey: "re_crystal_ball" }),
    crystalBallResendInterpreter,
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

  // Wire in-memory Cloudflare KV when cloudflareKv flag is set
  if (cloudflareKv) {
    const { MemoryCloudflareKvClient } = await import("./memory-cloudflare-kv-client");
    const pluginCfKv = await import("@mvfm/plugin-cloudflare-kv");
    const client = new MemoryCloudflareKvClient();
    injected.cloudflareKv = pluginCfKv.cloudflareKv;
    injected.memoryCloudflareKvInterpreter = pluginCfKv.createCloudflareKvInterpreter(client);
  }

  // Wire in-memory S3 when s3 flag is set
  if (s3) {
    const { MemoryS3Client } = await import("./memory-s3-client");
    const pluginS3 = await import("@mvfm/plugin-s3");
    const client = new MemoryS3Client();
    injected.s3_ = pluginS3.s3({ region: "us-east-1" });
    injected.memoryS3Interpreter = pluginS3.createS3Interpreter(client);
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
