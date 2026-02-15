import type Anthropic from "@anthropic-ai/sdk";
import type { AnthropicClient } from "./interpreter";

/**
 * Wraps the official Anthropic SDK into an {@link AnthropicClient}.
 *
 * Uses the SDK's HTTP methods (`post`, `get`, `delete`) to send requests,
 * preserving the SDK's built-in authentication, retries, and telemetry.
 *
 * For GET requests, params are encoded as query string parameters
 * on the path, since the SDK's `get` only accepts a path.
 *
 * @param client - A configured Anthropic SDK instance.
 * @returns An {@link AnthropicClient} adapter.
 */
export function wrapAnthropicSdk(client: Anthropic): AnthropicClient {
  return {
    async request(
      method: string,
      path: string,
      params?: Record<string, unknown>,
    ): Promise<unknown> {
      const upperMethod = method.toUpperCase();

      if (upperMethod === "POST") {
        return client.post(path, { body: params ?? undefined });
      }

      if (upperMethod === "DELETE") {
        return client.delete(path);
      }

      // GET: encode params as query string
      let finalPath = path;
      if (params && Object.keys(params).length > 0) {
        const qs = new URLSearchParams(
          Object.entries(params).map(([k, v]) => [k, String(v)]),
        ).toString();
        finalPath = `${path}?${qs}`;
      }
      return client.get(finalPath);
    },
  };
}
