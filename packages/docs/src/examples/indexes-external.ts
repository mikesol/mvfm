import type { NamespaceIndex } from "./types";

const externalIndexes: Record<string, NamespaceIndex> = {
  anthropic: {
    content: `<p>Implementation of the <a href="https://docs.anthropic.com/en/api/messages">Anthropic Messages API</a>. There is no default interpreter because this plugin requires API credentials.</p>
<p>Use <code>anthropic({ apiKey })</code> in your app and provide a configured interpreter at runtime.</p>`,
    staticCode: `import { anthropic, wrapAnthropicSdk } from "@mvfm/plugin-anthropic";
import Anthropic from "@anthropic-ai/sdk";

// 1. Create an Anthropic SDK client
const sdk = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const client = wrapAnthropicSdk(sdk);

// 2. Build the interpreter
const anthropicInterp = createAnthropicInterpreter(client);

// 3. Merge and run
const app = mvfm(prelude, anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));
const baseInterp = defaults(app);
await fold(
  { ...baseInterp, ...anthropicInterp },
  prog
);`,
  },

  "cloudflare-kv": {
    content: `<p>Implementation of Cloudflare KV operations. There is no default interpreter because KV requires a configured namespace.</p>
<p>The playground uses an in-memory KV mock to keep examples deterministic and side-effect free.</p>`,
    staticCode: `import { cloudflareKv, createCloudflareKvInterpreter, wrapKVNamespace } from "@mvfm/plugin-cloudflare-kv";

// 1. Wrap a Cloudflare Workers KV namespace
const client = wrapKVNamespace(env.MY_KV_NAMESPACE);

// 2. Build the interpreter
const kvInterp = createCloudflareKvInterpreter(client);

// 3. Merge and run
const app = mvfm(prelude, cloudflareKv);
const baseInterp = defaults(app);
await fold(
  { ...baseInterp, ...kvInterp },
  prog
);`,
  },

  fal: {
    content: `<p>Implementation of the <a href="https://fal.ai/models">Fal AI API</a>. There is no default interpreter because calls require credentials and network access.</p>
<p>Examples use mocked responses via <code>mockInterpreter</code> so each node kind remains runnable in docs.</p>`,
    staticCode: `import { fal, wrapFalSdk } from "@mvfm/plugin-fal";
import * as falSdk from "@fal-ai/serverless-client";

// 1. Configure the Fal SDK
falSdk.config({ credentials: process.env.FAL_KEY });
const client = wrapFalSdk(falSdk);

// 2. Build the interpreter
const falInterp = createFalInterpreter(client);

// 3. Merge and run
const app = mvfm(prelude, fal({ credentials: process.env.FAL_KEY }));
const baseInterp = defaults(app);
await fold(
  { ...baseInterp, ...falInterp },
  prog
);`,
  },

  fetch: {
    content: `<p>Implementation of the WHATWG Fetch API. The plugin models request/response operations as explicit AST nodes.</p>
<p>Use this for deterministic HTTP interaction patterns, including status/header/body extraction.</p>`,
    staticCode: `import { fetch, wrapFetch, createFetchInterpreter } from "@mvfm/plugin-fetch";

// 1. Wrap the global fetch (or provide a custom implementation)
const client = wrapFetch(globalThis.fetch);

// 2. Build the interpreter
const fetchInterp = createFetchInterpreter(client);

// 3. Merge and run
const app = mvfm(prelude, fetch());
const baseInterp = defaults(app);
await fold(
  { ...baseInterp, ...fetchInterp },
  prog
);`,
  },

  openai: {
    content: `<p>Implementation of the <a href="https://platform.openai.com/docs/api-reference">OpenAI API</a>. There is no default interpreter because this plugin requires an API key.</p>
<p>Examples run with mocked interpreters to make output deterministic while preserving realistic call shapes.</p>`,
    staticCode: `import { openai, wrapOpenAISdk } from "@mvfm/plugin-openai";
import OpenAI from "openai";

// 1. Create an OpenAI SDK client
const sdk = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const client = wrapOpenAISdk(sdk);

// 2. Build the interpreter
const openaiInterp = createOpenAIInterpreter(client);

// 3. Merge and run
const app = mvfm(prelude, openai({ apiKey: process.env.OPENAI_API_KEY }));
const baseInterp = defaults(app);
await fold(
  { ...baseInterp, ...openaiInterp },
  prog
);`,
  },

  pino: {
    content: `<p>Implementation of the <a href="https://github.com/pinojs/pino">Pino logger API</a>. There is no default interpreter because logging targets are application-defined.</p>
<p>The docs playground routes logs to an in-memory sink so you can inspect behavior directly.</p>`,
    staticCode: `import { pino, wrapPino, createPinoInterpreter } from "@mvfm/plugin-pino";
import pinoLib from "pino";

// 1. Create a pino logger instance
const logger = pinoLib({ level: "info" });
const client = wrapPino(logger);

// 2. Build the interpreter
const pinoInterp = createPinoInterpreter(client);

// 3. Merge and run
const app = mvfm(prelude, pino());
const baseInterp = defaults(app);
await fold(
  { ...baseInterp, ...pinoInterp },
  prog
);`,
  },

  postgres: {
    content: `<p>Implementation of <a href="https://github.com/porsager/postgres">postgres.js</a>. There is no default interpreter because it requires a live database connection.</p>
<p>You construct one by calling <code>serverInterpreter(client, baseInterpreter)</code> with a connected client. The playground examples on this site use <code>wasmPgInterpreter</code>, backed by PGLite, an in-browser WASM build of Postgres.</p>`,
    staticCode: `import { postgres, serverInterpreter, wrapPostgresJs } from "@mvfm/plugin-postgres";
import postgresJs from "postgres";

// 1. Create a postgres.js client
const sql = postgresJs("postgres://user:pass@localhost:5432/mydb");
const client = wrapPostgresJs(sql);

// 2. Build a base interpreter for sub-expressions
const baseInterp = defaults(app);

// 3. Create the postgres interpreter
const pgInterp = serverInterpreter(client, baseInterp);

// 4. Merge and run
await fold(
  { ...baseInterp, ...pgInterp },
  injectInput(prog, { userId: 42 })
);`,
  },

  redis: {
    content: `<p>Implementation of Redis command groups (strings, hashes, lists, and keys). There is no default interpreter because Redis requires a client connection.</p>
<p>The docs playground uses an in-memory Redis interpreter so examples remain deterministic.</p>`,
    staticCode: `import { redis, wrapIoredis, createRedisInterpreter } from "@mvfm/plugin-redis";
import Redis from "ioredis";

// 1. Create an ioredis client
const ioredis = new Redis("redis://localhost:6379");
const client = wrapIoredis(ioredis);

// 2. Build the interpreter
const redisInterp = createRedisInterpreter(client);

// 3. Merge and run
const app = mvfm(prelude, redis());
const baseInterp = defaults(app);
await fold(
  { ...baseInterp, ...redisInterp },
  prog
);`,
  },

  resend: {
    content: `<p>Implementation of the <a href="https://resend.com/docs/api-reference">Resend API</a>. There is no default interpreter because this plugin requires an API key.</p>
<p>Examples are wired to fixture-backed mocks so request/response behavior is reproducible in the playground.</p>`,
    staticCode: `import { resend, wrapResendSdk, createResendInterpreter } from "@mvfm/plugin-resend";
import { Resend } from "resend";

// 1. Create a Resend SDK client
const sdk = new Resend(process.env.RESEND_API_KEY);
const client = wrapResendSdk(sdk);

// 2. Build the interpreter
const resendInterp = createResendInterpreter(client);

// 3. Merge and run
const app = mvfm(prelude, resend({ apiKey: process.env.RESEND_API_KEY }));
const baseInterp = defaults(app);
await fold(
  { ...baseInterp, ...resendInterp },
  prog
);`,
  },

  s3: {
    content: `<p>Implementation of Amazon S3 object operations. There is no default interpreter because this plugin requires configured AWS client access.</p>
<p>Docs examples use an in-memory S3 mock so behavior is deterministic and runnable in-browser.</p>`,
    staticCode: `import { s3, wrapAwsSdk, createS3Interpreter } from "@mvfm/plugin-s3";
import { S3Client as AwsS3Client } from "@aws-sdk/client-s3";

// 1. Create an AWS SDK S3 client
const awsClient = new AwsS3Client({ region: "us-east-1" });
const client = wrapAwsSdk(awsClient);

// 2. Build the interpreter
const s3Interp = createS3Interpreter(client);

// 3. Merge and run
const app = mvfm(prelude, s3({ region: "us-east-1" }));
const baseInterp = defaults(app);
await fold(
  { ...baseInterp, ...s3Interp },
  prog
);`,
  },

  slack: {
    content: `<p>Implementation of the <a href="https://api.slack.com/methods">Slack Web API</a>. There is no default interpreter because this plugin requires a bot token.</p>
<p>The playground uses mocked API responses so message and channel operations are deterministic.</p>`,
    staticCode: `import { slack, wrapSlackWebClient, createSlackInterpreter } from "@mvfm/plugin-slack";
import { WebClient } from "@slack/web-api";

// 1. Create a Slack Web API client
const webClient = new WebClient(process.env.SLACK_BOT_TOKEN);
const client = wrapSlackWebClient(webClient);

// 2. Build the interpreter
const slackInterp = createSlackInterpreter(client);

// 3. Merge and run
const app = mvfm(prelude, slack({ token: process.env.SLACK_BOT_TOKEN }));
const baseInterp = defaults(app);
await fold(
  { ...baseInterp, ...slackInterp },
  prog
);`,
  },

  stripe: {
    content: `<p>Implementation of the <a href="https://docs.stripe.com/api">Stripe API</a>. There is no default interpreter because this plugin requires an API key.</p>
<p>Examples use mocked interpreters to keep all payment node kinds runnable in docs without external side effects.</p>`,
    staticCode: `import { stripe, wrapStripeSdk, createStripeInterpreter } from "@mvfm/plugin-stripe";
import Stripe from "stripe";

// 1. Create a Stripe SDK client
const sdk = new Stripe(process.env.STRIPE_API_KEY);
const client = wrapStripeSdk(sdk);

// 2. Build the interpreter
const stripeInterp = createStripeInterpreter(client);

// 3. Merge and run
const app = mvfm(prelude, stripe({ apiKey: process.env.STRIPE_API_KEY }));
const baseInterp = defaults(app);
await fold(
  { ...baseInterp, ...stripeInterp },
  prog
);`,
  },

  twilio: {
    content: `<p>Implementation of the <a href="https://www.twilio.com/docs/usage/api">Twilio REST API</a>. There is no default interpreter because this plugin requires account credentials.</p>
<p>The documented node kinds currently cover message and call operations with deterministic mocked execution in the playground.</p>`,
    staticCode: `import { twilio, wrapTwilioSdk, createTwilioInterpreter } from "@mvfm/plugin-twilio";
import twilioSdk from "twilio";

// 1. Create a Twilio SDK client
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const sdk = twilioSdk(accountSid, process.env.TWILIO_AUTH_TOKEN);
const client = wrapTwilioSdk(sdk);

// 2. Build the interpreter (requires accountSid for API paths)
const twilioInterp = createTwilioInterpreter(client, accountSid);

// 3. Merge and run
const app = mvfm(prelude, twilio);
const baseInterp = defaults(app);
await fold(
  { ...baseInterp, ...twilioInterp },
  prog
);`,
  },
};

export { externalIndexes };
