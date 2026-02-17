import { typedInterpreter } from "@mvfm/core";
import type { AnthropicCountTokensNode, AnthropicCreateMessageNode } from "../0.74.0/interpreter";

// Positive: registered kind with correct node type compiles.
const _positive = typedInterpreter<"anthropic/create_message">()({
  // biome-ignore lint/correctness/useYield: type-only compile test
  "anthropic/create_message": async function* (node: AnthropicCreateMessageNode) {
    return node.params;
  },
});

// Negative: node:any must be rejected for registered kinds.
const _badAny = typedInterpreter<"anthropic/create_message">()({
  // @ts-expect-error node:any must be rejected for registered anthropic kinds
  // biome-ignore lint/correctness/useYield: type-only compile test
  "anthropic/create_message": async function* (node: any) {
    return node;
  },
});

// Negative: wrong node interface must be rejected.
const _wrongType = typedInterpreter<"anthropic/create_message">()({
  // @ts-expect-error wrong node interface for anthropic/create_message
  // biome-ignore lint/correctness/useYield: type-only compile test
  "anthropic/create_message": async function* (node: AnthropicCountTokensNode) {
    return node.params;
  },
});

void _positive;
void _badAny;
void _wrongType;
