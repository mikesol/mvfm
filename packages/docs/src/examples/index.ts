import boolean from "./boolean";
import console_ from "./console";
import control from "./control";
import core from "./core";
import eq from "./eq";
import error from "./error";
import fetch from "./fetch";
import fiber from "./fiber";
import indexes from "./indexes";
import num from "./num";
import openai from "./openai";
import ord from "./ord";
import pino from "./pino";
import postgres from "./postgres";
import redisHashes from "./redis-hashes";
import redisKeys from "./redis-keys";
import redisLists from "./redis-lists";
import redisStrings from "./redis-strings";
import st from "./st";
import str from "./str";
import type { ExampleEntry } from "./types";
import zodSchemas from "./zod-schemas";
import zodSchemasMore from "./zod-schemas-more";
import zodWrappers from "./zod-wrappers";

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
  fetch,
  openai,
  postgres,
  redisHashes,
  redisKeys,
  redisLists,
  redisStrings,
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
