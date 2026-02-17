import boolean from "./boolean";
import console_ from "./console";
import control from "./control";
import core from "./core";
import eq from "./eq";
import error from "./error";
import fiber from "./fiber";
import num from "./num";
import ord from "./ord";
import st from "./st";
import str from "./str";
import type { NodeExample } from "./types";

const modules: Record<string, NodeExample>[] = [
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
];

export function getAllExamples(): Record<string, NodeExample> {
  return Object.assign({}, ...modules);
}
