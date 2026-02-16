import type { NodeExample } from "./types";
import boolean from "./boolean";
import core from "./core";
import eq from "./eq";
import num from "./num";
import ord from "./ord";
import str from "./str";

const modules: Record<string, NodeExample>[] = [core, boolean, num, str, ord, eq];

export function getAllExamples(): Record<string, NodeExample> {
  return Object.assign({}, ...modules);
}
