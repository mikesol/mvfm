import type OpenAI from "openai";
import type { OpenAIClient } from "./interpreter";

/**
 * Wraps the official OpenAI SDK into an {@link OpenAIClient}.
 *
 * Uses the SDK's built-in HTTP methods (`post`, `get`, `delete`)
 * to send requests, preserving authentication, retries, and telemetry.
 *
 * @param client - A configured OpenAI SDK instance.
 * @returns An {@link OpenAIClient} adapter.
 */
export function wrapOpenAISdk(client: OpenAI): OpenAIClient {
  return {
    async request(method: string, path: string, body?: Record<string, unknown>): Promise<unknown> {
      const upperMethod = method.toUpperCase();

      switch (upperMethod) {
        case "POST":
          return client.post(path, { body: body ?? {} });
        case "GET":
          return client.get(path, { query: body });
        case "DELETE":
          return client.delete(path);
        default:
          throw new Error(`wrapOpenAISdk: unsupported method "${method}"`);
      }
    },
  };
}
