import type { TwilioClient } from "./interpreter";

/**
 * Minimal interface for a Twilio SDK client instance.
 * Avoids requiring the `twilio` package as a dependency.
 */
interface TwilioSdkClient {
  request(opts: {
    method: string;
    uri: string;
    data?: Record<string, unknown>;
  }): Promise<{ body: unknown }>;
}

/**
 * Wraps a Twilio SDK client into a {@link TwilioClient}.
 *
 * Uses the SDK's `request()` method to send requests, preserving
 * the SDK's built-in authentication and configuration.
 *
 * For POST requests, params are sent as `data` in the request body.
 * For GET/DELETE requests, params are encoded as query string parameters
 * on the URI.
 *
 * @param client - A Twilio SDK client instance conforming to {@link TwilioSdkClient}.
 * @returns A {@link TwilioClient} adapter.
 */
export function wrapTwilioSdk(client: TwilioSdkClient): TwilioClient {
  return {
    async request(
      method: string,
      path: string,
      params?: Record<string, unknown>,
    ): Promise<unknown> {
      const upperMethod = method.toUpperCase();
      const baseUrl = "https://api.twilio.com";

      if (upperMethod === "POST") {
        // POST: params go in the request body
        const response = await client.request({
          method: upperMethod,
          uri: `${baseUrl}${path}`,
          data: params,
        });
        return response.body;
      }

      // GET/DELETE: encode params as query string
      let uri = `${baseUrl}${path}`;
      if (params && Object.keys(params).length > 0) {
        const qs = new URLSearchParams(
          Object.entries(params).map(([k, v]) => [k, String(v)]),
        ).toString();
        uri = `${uri}?${qs}`;
      }
      const response = await client.request({
        method: upperMethod,
        uri,
      });
      return response.body;
    },
  };
}
