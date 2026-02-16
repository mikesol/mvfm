import type { NodeExample } from "./types";
import core from "./core";

const modules: Record<string, NodeExample>[] = [core];

export function getAllExamples(): Record<string, NodeExample> {
  return Object.assign({}, ...modules);
}
