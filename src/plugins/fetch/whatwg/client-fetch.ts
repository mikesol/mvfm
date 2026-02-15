import type { FetchClient } from "./interpreter";

/**
 * Wraps `globalThis.fetch` into a {@link FetchClient}.
 *
 * Uses the standard Fetch API directly. The optional `fetchFn` parameter
 * allows injecting a custom fetch implementation (e.g., for testing or
 * environments without global fetch).
 *
 * @param fetchFn - A fetch implementation. Defaults to `globalThis.fetch`.
 * @returns A {@link FetchClient} adapter.
 */
export function wrapFetch(fetchFn?: typeof globalThis.fetch): FetchClient {
  const fn = fetchFn ?? globalThis.fetch;
  return {
    async request(url: string, init?: RequestInit): Promise<Response> {
      return fn(url, init);
    },
  };
}
