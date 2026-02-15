import type { FalClient as FalSdk } from "@fal-ai/client";
import type { FalClient } from "./interpreter";

/**
 * Wraps the official `\@fal-ai/client` into a {@link FalClient}.
 *
 * Delegates to the real SDK's run, subscribe, and queue methods,
 * preserving the SDK's authentication, retries, and storage handling.
 *
 * @param client - A configured `\@fal-ai/client` FalClient instance.
 * @returns A {@link FalClient} adapter.
 */
export function wrapFalSdk(client: FalSdk): FalClient {
  return {
    async run(endpointId: string, input?: Record<string, unknown>): Promise<unknown> {
      const result = await client.run(endpointId, { input });
      return result;
    },

    async subscribe(endpointId: string, input?: Record<string, unknown>): Promise<unknown> {
      const result = await client.subscribe(endpointId, { input });
      return result;
    },

    async queueSubmit(endpointId: string, input?: Record<string, unknown>): Promise<unknown> {
      const result = await client.queue.submit(endpointId, { input });
      return result;
    },

    async queueStatus(endpointId: string, requestId: string): Promise<unknown> {
      const result = await client.queue.status(endpointId, { requestId });
      return result;
    },

    async queueResult(endpointId: string, requestId: string): Promise<unknown> {
      const result = await client.queue.result(endpointId, { requestId });
      return result;
    },

    async queueCancel(endpointId: string, requestId: string): Promise<void> {
      await client.queue.cancel(endpointId, { requestId });
    },
  };
}
