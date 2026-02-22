import type { FoldState, Interpreter, NExpr, PluginDef, RuntimeEntry } from "@mvfm/core";
import * as core from "@mvfm/core";
import type { ConsoleInstance } from "@mvfm/plugin-console";
import * as pluginConsole from "@mvfm/plugin-console";
import * as pluginZod from "@mvfm/plugin-zod";
import * as pluginFetch from "@mvfm/plugin-fetch";
import type { PinoClient } from "@mvfm/plugin-pino";
import * as pluginPino from "@mvfm/plugin-pino";
import * as pluginSlack from "@mvfm/plugin-slack";
import * as pluginOpenAI from "@mvfm/plugin-openai";
import * as pluginAnthropic from "@mvfm/plugin-anthropic";
import * as pluginFal from "@mvfm/plugin-fal";
import * as pluginStripe from "@mvfm/plugin-stripe";
import * as pluginTwilio from "@mvfm/plugin-twilio";
import * as pluginResend from "@mvfm/plugin-resend";
import * as pluginPostgres from "@mvfm/plugin-postgres";
import * as pluginRedis from "@mvfm/plugin-redis";
import * as pluginCfKv from "@mvfm/plugin-cloudflare-kv";
import * as pluginS3 from "@mvfm/plugin-s3";
import { wrapPgLite, type PgLiteQueryable } from "./pglite-adapter";
import { MemoryRedisClient } from "./memory-redis-client";
import { MemoryCloudflareKvClient } from "./memory-cloudflare-kv-client";
import { MemoryS3Client } from "./memory-s3-client";
import {
  createCrystalBallAnthropicClient,
  createCrystalBallFalClient,
  createCrystalBallOpenAIClient,
  createCrystalBallResendClient,
  createCrystalBallStripeClient,
} from "./crystal-ball-clients";

const { console: _drop, consoleInterpreter: _defaultInterp, ...consoleRest } = {
  ...pluginConsole,
};

/** Builds the injected scope for playground code execution. */
export function createPlaygroundScope(
  fakeConsole: ConsoleInstance,
  mockInterpreter?: Record<string, unknown>,
  pgliteDb?: PgLiteQueryable,
  redis?: true,
  s3?: true,
  cloudflareKv?: true,
) {
  const fakeConsoleInterpreter = pluginConsole.createConsoleInterpreter(
    pluginConsole.wrapConsole(fakeConsole),
  );

  // Group mock handler keys (e.g. "st/let") by plugin name (e.g. "st")
  // so they can be passed as overrides to defaults().
  const mockOverrides: Record<string, Interpreter> = {};
  if (mockInterpreter) {
    for (const [key, handler] of Object.entries(mockInterpreter)) {
      const pluginName = key.split("/")[0];
      if (!mockOverrides[pluginName]) mockOverrides[pluginName] = {} as Interpreter;
      (mockOverrides[pluginName] as Record<string, unknown>)[key] = handler;
    }
  }

  // Track the last fold return value for display in the playground.
  let lastFoldResult: unknown;

  // Build a fake pino client that routes log output to fakeConsole
  const fakePinoClient: PinoClient = {
    async log(level, bindings, mergeObject, msg) {
      const parts: unknown[] = [`[pino:${level}]`];
      for (const b of bindings) parts.push(JSON.stringify(b));
      if (mergeObject) parts.push(JSON.stringify(mergeObject));
      if (msg) parts.push(msg);
      fakeConsole.log(...parts);
    },
  };
  const fakePinoInterpreter = pluginPino.createPinoInterpreter(fakePinoClient);

  const crystalBallOpenAIInterpreter = pluginOpenAI.createOpenAIInterpreter(
    createCrystalBallOpenAIClient(),
  );

  const crystalBallAnthropicInterpreter = pluginAnthropic.createAnthropicInterpreter(
    createCrystalBallAnthropicClient(),
  );

  const crystalBallFalInterpreter = pluginFal.createFalInterpreter(createCrystalBallFalClient());

  const crystalBallStripeInterpreter = pluginStripe.createStripeInterpreter(
    createCrystalBallStripeClient(),
  );

  const crystalBallTwilioInterpreter = pluginTwilio.createTwilioInterpreter(
    {
      async request(method: string, path: string, params?: Record<string, unknown>) {
        return {
          method,
          path,
          params: params ?? null,
          sid: "TWILIO_CRYSTAL_BALL",
          status: "queued",
        };
      },
    },
    "AC_CRYSTAL_BALL",
  );

  const crystalBallResendInterpreter = pluginResend.createResendInterpreter(
    createCrystalBallResendClient(),
  );

  // Exclude core exports whose names clash with common example variable names
  // (e.g. `const app = mvfm(prelude)` conflicts with core's `app` export).
  const { app: _app, ...coreRest } = { ...core } as Record<string, unknown>;
  const injected: Record<string, unknown> = {
    ...coreRest,
    console_: pluginConsole.consolePlugin(),
    ...consoleRest,
    zod: pluginZod.zod(),
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
    twilio_: pluginTwilio.twilio,
    crystalBallTwilioInterpreter,
    slack_: pluginSlack.slack({ token: "xoxb-mock-token" }),

    resend_: pluginResend.resend({ apiKey: "re_crystal_ball" }),
    crystalBallResendInterpreter,
  };

  // Wire PGLite-backed postgres when a db instance is provided
  if (pgliteDb) {
    const pg = pluginPostgres.postgres();
    const client = wrapPgLite(pgliteDb);
    injected.pg = pg;
    injected.wasmPgInterpreter = pluginPostgres.createPostgresServerInterpreter(client);

    injected.defaults = (plugins: readonly PluginDef[], overrides?: Record<string, Interpreter>) => {
      const merged = { ...mockOverrides, ...overrides };
      const interp = core.defaults(plugins, merged);
      Object.assign(interp, fakeConsoleInterpreter, fakePinoInterpreter);
      return interp;
    };
  } else {
    injected.defaults = (plugins: readonly PluginDef[], overrides?: Record<string, Interpreter>) => {
      const merged = { ...mockOverrides, ...overrides };
      const interp = core.defaults(plugins, merged);
      Object.assign(interp, fakeConsoleInterpreter, fakePinoInterpreter);
      return interp;
    };
  }

  // Wire in-memory Redis when redis flag is set
  if (redis) {
    const client = new MemoryRedisClient();
    injected.redis = pluginRedis.redis();
    injected.memoryRedisInterpreter = pluginRedis.createRedisInterpreter(client);
  }

  // Wire in-memory Cloudflare KV when cloudflareKv flag is set
  if (cloudflareKv) {
    const client = new MemoryCloudflareKvClient();
    injected.cloudflareKv = pluginCfKv.cloudflareKv;
    injected.memoryCloudflareKvInterpreter = pluginCfKv.createCloudflareKvInterpreter(client);
  }

  // Wire in-memory S3 when s3 flag is set
  if (s3) {
    const client = new MemoryS3Client();
    injected.s3_ = pluginS3.s3({ region: "us-east-1" });
    injected.memoryS3Interpreter = pluginS3.createS3Interpreter(client);
  }

  // Wrap fold to track the last result for playground display.
  // Cast needed at this dynamic injection boundary — fold has overloaded
  // signatures that can't be expressed in a single wrapper type.
  const foldImpl = core.fold as (
    ...args: [
      string | NExpr<any, any, any, any>,
      Record<string, RuntimeEntry> | Interpreter,
      (Interpreter | FoldState)?,
      FoldState?,
    ]
  ) => Promise<unknown>;
  injected.fold = async (...args: unknown[]) => {
    const result = await foldImpl(
      ...(args as Parameters<typeof foldImpl>),
    );
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
