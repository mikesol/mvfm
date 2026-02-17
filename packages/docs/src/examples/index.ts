import boolean from "./boolean";
import console_ from "./console";
import control from "./control";
import core from "./core";
import eq from "./eq";
import error from "./error";
import fiber from "./fiber";
import num from "./num";
import ord from "./ord";
import postgres from "./postgres";
import st from "./st";
import str from "./str";
import indexes from "./indexes";
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
  postgres,
  zodSchemas,
  zodSchemasMore,
  zodWrappers,
  indexes,
];

/** Returns all example entries (node-kind examples + namespace index pages). */
export function getAllExamples(): Record<string, ExampleEntry> {
  return Object.assign({}, ...modules);
}
