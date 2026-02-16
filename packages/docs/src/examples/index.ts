import type { NodeExample } from "./types";

const modules: Record<string, NodeExample>[] = [];

export function getAllExamples(): Record<string, NodeExample> {
  return Object.assign({}, ...modules);
}
