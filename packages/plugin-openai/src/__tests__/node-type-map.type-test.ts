import { defineInterpreter } from "@mvfm/core";
import type {
  OpenAICreateChatCompletionNode,
  OpenAICreateEmbeddingNode,
} from "../6.21.0/interpreter";

// Positive: registered kind with correct node type compiles.
const _positive = defineInterpreter<"openai/create_chat_completion">()({
  // biome-ignore lint/correctness/useYield: type-only compile test
  "openai/create_chat_completion": async function* (node: OpenAICreateChatCompletionNode) {
    return node.params;
  },
});

// Negative: node:any must be rejected for registered kinds.
const _badAny = defineInterpreter<"openai/create_chat_completion">()({
  // @ts-expect-error node:any must be rejected for registered openai kinds
  // biome-ignore lint/correctness/useYield: type-only compile test
  "openai/create_chat_completion": async function* (node: any) {
    return node;
  },
});

// Negative: wrong node interface must be rejected.
const _wrongType = defineInterpreter<"openai/create_chat_completion">()({
  // @ts-expect-error wrong node interface for openai/create_chat_completion
  // biome-ignore lint/correctness/useYield: type-only compile test
  "openai/create_chat_completion": async function* (node: OpenAICreateEmbeddingNode) {
    return node.params;
  },
});

void _positive;
void _badAny;
void _wrongType;
