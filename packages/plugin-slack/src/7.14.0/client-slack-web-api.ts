import type { WebClient } from "@slack/web-api";
import type { SlackClient } from "./generated/interpreter";

/**
 * Wraps a `@slack/web-api` `WebClient` instance into the
 * abstract {@link SlackClient} interface consumed by the slack handler.
 *
 * This adapter decouples the handler from the concrete SDK, allowing
 * tests to substitute mock clients while production code uses the
 * real `WebClient`.
 *
 * @param client - The `@slack/web-api` `WebClient` instance to wrap.
 * @returns A {@link SlackClient} that delegates to the underlying `WebClient`
 */
export function wrapSlackWebClient(client: WebClient): SlackClient {
  return {
    async apiCall(method: string, params?: Record<string, unknown>): Promise<unknown> {
      return client.apiCall(method, params ?? {});
    },
  };
}
