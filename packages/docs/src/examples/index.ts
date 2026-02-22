import { examples as anthropic } from "./anthropic";
import { examples as boolean } from "./boolean";
import { examples as cloudflareKv } from "./cloudflare-kv";
import { examples as console_ } from "./console";
import { examples as control } from "./control";
import { examples as core } from "./core";
import { examples as eq } from "./eq";
import { examples as error } from "./error";
import { examples as fal } from "./fal";
import { examples as fetch } from "./fetch";
import { examples as fiber } from "./fiber";
import { indexes } from "./indexes";
import { examples as num } from "./num";
import { examples as openai } from "./openai";
import { examples as ord } from "./ord";
import { examples as pino } from "./pino";
import { examples as postgres } from "./postgres";
import { examples as redisHashes } from "./redis-hashes";
import { examples as redisKeys } from "./redis-keys";
import { examples as redisLists } from "./redis-lists";
import { examples as redisStrings } from "./redis-strings";
import { examples as resend } from "./resend";
import { examples as s3 } from "./s3";
import { examples as slack } from "./slack";
import { examples as st } from "./st";
import { examples as str } from "./str";
import { examples as stripe } from "./stripe";
import { examples as twilio } from "./twilio";
import type { ExampleEntry } from "./types";
import { examples as zodSchemas } from "./zod-schemas";
import { examples as zodSchemasMore } from "./zod-schemas-more";
import { examples as zodWrappers } from "./zod-wrappers";

const modules: Record<string, ExampleEntry>[] = [
  core,
  boolean,
  num,
  str,
  ord,
  eq,
  st,
  control,
  error,
  fiber,
  console_,
  anthropic,
  fal,
  fetch,
  openai,
  postgres,
  redisHashes,
  redisKeys,
  redisLists,
  redisStrings,
  s3,
  slack,
  stripe,
  twilio,
  resend,
  cloudflareKv,
  zodSchemas,
  zodSchemasMore,
  zodWrappers,
  indexes,
  pino,
];

/** Returns all example entries (node-kind examples + namespace index pages). */
export function getAllExamples(): Record<string, ExampleEntry> {
  return Object.assign({}, ...modules);
}
