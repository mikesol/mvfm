// Public API

export type {
  ASTNode,
  Expr,
  GeneratorInterpreterFragment,
  Interpreter,
  InterpreterFragment,
  LegacyInterpreterFragment,
  MissingTraitError,
  Plugin,
  PluginContext,
  PluginDefinition,
  Program,
  RecurseFn,
  Step,
  StepContext,
  StepEffect,
  StepHandler,
  TraitImpl,
  TypeclassMapping,
  TypeclassSlot,
} from "./core";
// Note: GeneratorInterpreterFragment is kept as an export for backward
// compatibility — it is now a type alias for InterpreterFragment.
export { adaptLegacy, composeInterpreters, foldAST, mvfm, runAST, Stepper } from "./core";
export { coreInterpreter } from "./interpreters/core";
export type { AnthropicConfig, AnthropicMethods } from "./plugins/anthropic/0.74.0";
export { anthropic } from "./plugins/anthropic/0.74.0";
export { wrapAnthropicSdk } from "./plugins/anthropic/0.74.0/client-anthropic-sdk";
export type {
  ClientHandlerOptions as AnthropicClientHandlerOptions,
  ClientHandlerState as AnthropicClientHandlerState,
} from "./plugins/anthropic/0.74.0/handler.client";
export { clientHandler as anthropicClientHandler } from "./plugins/anthropic/0.74.0/handler.client";
export {
  serverEvaluate as anthropicServerEvaluate,
  serverHandler as anthropicServerHandler,
} from "./plugins/anthropic/0.74.0/handler.server";
export type { AnthropicClient } from "./plugins/anthropic/0.74.0/interpreter";
export { anthropicInterpreter } from "./plugins/anthropic/0.74.0/interpreter";
export type { BooleanMethods } from "./plugins/boolean";
export { boolean } from "./plugins/boolean";
export { booleanInterpreter } from "./plugins/boolean/interpreter";
export type { BoundedFor } from "./plugins/bounded";
export { bounded } from "./plugins/bounded";
// ---- cloudflare-kv plugin ----
export type {
  CloudflareKvConfig,
  CloudflareKvMethods,
  KvGet,
  KvListOptions,
  KvListResult,
  KvPutOptions,
} from "./plugins/cloudflare-kv/4.20260213.0";
export { cloudflareKv } from "./plugins/cloudflare-kv/4.20260213.0";
export type { KVNamespaceLike } from "./plugins/cloudflare-kv/4.20260213.0/client-cf-kv";
export { wrapKVNamespace } from "./plugins/cloudflare-kv/4.20260213.0/client-cf-kv";
export type {
  ClientHandlerOptions as CloudflareKvClientHandlerOptions,
  ClientHandlerState as CloudflareKvClientHandlerState,
} from "./plugins/cloudflare-kv/4.20260213.0/handler.client";
export { clientHandler as cloudflareKvClientHandler } from "./plugins/cloudflare-kv/4.20260213.0/handler.client";
export {
  serverEvaluate as cloudflareKvServerEvaluate,
  serverHandler as cloudflareKvServerHandler,
} from "./plugins/cloudflare-kv/4.20260213.0/handler.server";
export type { CloudflareKvClient } from "./plugins/cloudflare-kv/4.20260213.0/interpreter";
export { cloudflareKvInterpreter } from "./plugins/cloudflare-kv/4.20260213.0/interpreter";
export type { ControlMethods } from "./plugins/control";
export { control } from "./plugins/control";
export type { EqFor } from "./plugins/eq";
export { eq } from "./plugins/eq";
export { eqInterpreter } from "./plugins/eq/interpreter";
export type { ErrorMethods } from "./plugins/error";
export { error } from "./plugins/error";
export { errorInterpreter } from "./plugins/error/interpreter";
// ---- fal plugin ----
export type { FalConfig, FalMethods, FalQueueOptions, FalRunOptions } from "./plugins/fal/1.9.1";
export { fal } from "./plugins/fal/1.9.1";
export { wrapFalSdk } from "./plugins/fal/1.9.1/client-fal-sdk";
export type {
  ClientHandlerOptions as FalClientHandlerOptions,
  ClientHandlerState as FalClientHandlerState,
} from "./plugins/fal/1.9.1/handler.client";
export { clientHandler as falClientHandler } from "./plugins/fal/1.9.1/handler.client";
export {
  serverEvaluate as falServerEvaluate,
  serverHandler as falServerHandler,
} from "./plugins/fal/1.9.1/handler.server";
export type { FalClient } from "./plugins/fal/1.9.1/interpreter";
export { falInterpreter } from "./plugins/fal/1.9.1/interpreter";
export type { FiberMethods } from "./plugins/fiber";
export { fiber } from "./plugins/fiber";
export { fiberInterpreter } from "./plugins/fiber/interpreter";
export type { HeytingAlgebraFor } from "./plugins/heyting-algebra";
export { heytingAlgebra } from "./plugins/heyting-algebra";
export type { MonoidFor } from "./plugins/monoid";
export { monoid } from "./plugins/monoid";
export type { NumMethods } from "./plugins/num";
export { num } from "./plugins/num";
export { numInterpreter } from "./plugins/num/interpreter";
export type { OpenAIConfig, OpenAIMethods } from "./plugins/openai/6.21.0";
export { openai } from "./plugins/openai/6.21.0";
export { wrapOpenAISdk } from "./plugins/openai/6.21.0/client-openai-sdk";
export type {
  ClientHandlerOptions as OpenAIClientHandlerOptions,
  ClientHandlerState as OpenAIClientHandlerState,
} from "./plugins/openai/6.21.0/handler.client";
export { clientHandler as openaiClientHandler } from "./plugins/openai/6.21.0/handler.client";
export {
  serverEvaluate as openaiServerEvaluate,
  serverHandler as openaiServerHandler,
} from "./plugins/openai/6.21.0/handler.server";
export type { OpenAIClient } from "./plugins/openai/6.21.0/interpreter";
export { openaiInterpreter } from "./plugins/openai/6.21.0/interpreter";
export type { OrdFor } from "./plugins/ord";
export { ord } from "./plugins/ord";
export { ordInterpreter } from "./plugins/ord/interpreter";
// ---- pino ----
export type { PinoConfig, PinoLogger, PinoMethods } from "./plugins/pino/10.3.1";
export { pino } from "./plugins/pino/10.3.1";
export { wrapPino } from "./plugins/pino/10.3.1/client-pino";
export type {
  ClientHandlerOptions as PinoClientHandlerOptions,
  ClientHandlerState as PinoClientHandlerState,
} from "./plugins/pino/10.3.1/handler.client";
export { clientHandler as pinoClientHandler } from "./plugins/pino/10.3.1/handler.client";
export {
  serverEvaluate as pinoServerEvaluate,
  serverHandler as pinoServerHandler,
} from "./plugins/pino/10.3.1/handler.server";
export type { PinoClient } from "./plugins/pino/10.3.1/interpreter";
export { pinoInterpreter } from "./plugins/pino/10.3.1/interpreter";
export type { PostgresConfig, PostgresMethods } from "./plugins/postgres/3.4.8";
export { postgres } from "./plugins/postgres/3.4.8";
export { wrapPostgresJs } from "./plugins/postgres/3.4.8/client-postgres-js";
export type {
  ClientHandlerOptions,
  ClientHandlerState,
} from "./plugins/postgres/3.4.8/handler.client";
export { clientHandler } from "./plugins/postgres/3.4.8/handler.client";
export { serverEvaluate, serverHandler } from "./plugins/postgres/3.4.8/handler.server";
export type { PostgresClient } from "./plugins/postgres/3.4.8/interpreter";
export {
  escapeIdentifier,
  findCursorBatch,
  postgresInterpreter,
} from "./plugins/postgres/3.4.8/interpreter";
export type { RedisConfig, RedisMethods } from "./plugins/redis/5.4.1";
export { redis } from "./plugins/redis/5.4.1";
export { wrapIoredis } from "./plugins/redis/5.4.1/client-ioredis";
export type {
  ClientHandlerOptions as RedisClientHandlerOptions,
  ClientHandlerState as RedisClientHandlerState,
} from "./plugins/redis/5.4.1/handler.client";
export { clientHandler as redisClientHandler } from "./plugins/redis/5.4.1/handler.client";
export {
  serverEvaluate as redisServerEvaluate,
  serverHandler as redisServerHandler,
} from "./plugins/redis/5.4.1/handler.server";
export type { RedisClient } from "./plugins/redis/5.4.1/interpreter";
export { redisInterpreter } from "./plugins/redis/5.4.1/interpreter";
export type { ResendConfig, ResendMethods } from "./plugins/resend/6.9.2";
export { resend } from "./plugins/resend/6.9.2";
export { wrapResendSdk } from "./plugins/resend/6.9.2/client-resend-sdk";
export type {
  ClientHandlerOptions as ResendClientHandlerOptions,
  ClientHandlerState as ResendClientHandlerState,
} from "./plugins/resend/6.9.2/handler.client";
export { clientHandler as resendClientHandler } from "./plugins/resend/6.9.2/handler.client";
export {
  serverEvaluate as resendServerEvaluate,
  serverHandler as resendServerHandler,
} from "./plugins/resend/6.9.2/handler.server";
export type { ResendClient } from "./plugins/resend/6.9.2/interpreter";
export { resendInterpreter } from "./plugins/resend/6.9.2/interpreter";
export type { S3Config, S3Methods } from "./plugins/s3/3.989.0";
export { s3 } from "./plugins/s3/3.989.0";
export { wrapAwsSdk } from "./plugins/s3/3.989.0/client-aws-sdk";
export type {
  ClientHandlerOptions as S3ClientHandlerOptions,
  ClientHandlerState as S3ClientHandlerState,
} from "./plugins/s3/3.989.0/handler.client";
export { clientHandler as s3ClientHandler } from "./plugins/s3/3.989.0/handler.client";
export {
  serverEvaluate as s3ServerEvaluate,
  serverHandler as s3ServerHandler,
} from "./plugins/s3/3.989.0/handler.server";
export type { S3Client } from "./plugins/s3/3.989.0/interpreter";
export { s3Interpreter } from "./plugins/s3/3.989.0/interpreter";
export type { SemigroupFor } from "./plugins/semigroup";
export { semigroup } from "./plugins/semigroup";
export type { SemiringFor } from "./plugins/semiring";
export { semiring } from "./plugins/semiring";
export type { ShowFor } from "./plugins/show";
export { show } from "./plugins/show";
// ---- Slack plugin (@slack/web-api 7.14.0) ----
export type { SlackConfig, SlackMethods } from "./plugins/slack/7.14.0";
export { slack } from "./plugins/slack/7.14.0";
export { wrapSlackWebClient } from "./plugins/slack/7.14.0/client-slack-web-api";
export type {
  ClientHandlerOptions as SlackClientHandlerOptions,
  ClientHandlerState as SlackClientHandlerState,
} from "./plugins/slack/7.14.0/handler.client";
export { clientHandler as slackClientHandler } from "./plugins/slack/7.14.0/handler.client";
export {
  serverEvaluate as slackServerEvaluate,
  serverHandler as slackServerHandler,
} from "./plugins/slack/7.14.0/handler.server";
export type { SlackClient } from "./plugins/slack/7.14.0/interpreter";
export { slackInterpreter } from "./plugins/slack/7.14.0/interpreter";
export type { StMethods } from "./plugins/st";
export { st } from "./plugins/st";
export type { StrMethods } from "./plugins/str";
export { str } from "./plugins/str";
export { strInterpreter } from "./plugins/str/interpreter";
export type { StripeConfig, StripeMethods } from "./plugins/stripe/2025-04-30.basil";
export { stripe } from "./plugins/stripe/2025-04-30.basil";
export { wrapStripeSdk } from "./plugins/stripe/2025-04-30.basil/client-stripe-sdk";
export type {
  ClientHandlerOptions as StripeClientHandlerOptions,
  ClientHandlerState as StripeClientHandlerState,
} from "./plugins/stripe/2025-04-30.basil/handler.client";
export { clientHandler as stripeClientHandler } from "./plugins/stripe/2025-04-30.basil/handler.client";
export {
  serverEvaluate as stripeServerEvaluate,
  serverHandler as stripeServerHandler,
} from "./plugins/stripe/2025-04-30.basil/handler.server";
export type { StripeClient } from "./plugins/stripe/2025-04-30.basil/interpreter";
export { stripeInterpreter } from "./plugins/stripe/2025-04-30.basil/interpreter";
export type {
  TwilioCallContext,
  TwilioCallsResource,
  TwilioConfig,
  TwilioMessageContext,
  TwilioMessagesResource,
  TwilioMethods,
} from "./plugins/twilio/5.5.1";
export { twilio } from "./plugins/twilio/5.5.1";
export { wrapTwilioSdk } from "./plugins/twilio/5.5.1/client-twilio-sdk";
export type {
  ClientHandlerOptions as TwilioClientHandlerOptions,
  ClientHandlerState as TwilioClientHandlerState,
} from "./plugins/twilio/5.5.1/handler.client";
export { clientHandler as twilioClientHandler } from "./plugins/twilio/5.5.1/handler.client";
export {
  serverEvaluate as twilioServerEvaluate,
  serverHandler as twilioServerHandler,
} from "./plugins/twilio/5.5.1/handler.server";
export type { TwilioClient } from "./plugins/twilio/5.5.1/interpreter";
export { twilioInterpreter } from "./plugins/twilio/5.5.1/interpreter";
export type {
  ArraySchema,
  InferSchema,
  NullableSchema,
  SchemaShape,
  SchemaTag,
  SchemaType,
} from "./schema";
export { array, nullable } from "./schema";
export { inferType, resolveSchemaType } from "./trait-utils";
