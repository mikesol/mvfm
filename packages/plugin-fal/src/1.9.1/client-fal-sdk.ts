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
    async run(
      endpointId: string,
      options?: Parameters<FalSdk["run"]>[1],
    ): Promise<Awaited<ReturnType<FalSdk["run"]>>> {
      const result = await client.run(endpointId, options as any);
      return result;
    },

    async subscribe(
      endpointId: string,
      options?: Parameters<FalSdk["subscribe"]>[1],
    ): Promise<Awaited<ReturnType<FalSdk["subscribe"]>>> {
      const result = await client.subscribe(endpointId, options as any);
      return result;
    },

    async queueSubmit(
      endpointId: string,
      options: Parameters<FalSdk["queue"]["submit"]>[1],
    ): Promise<Awaited<ReturnType<FalSdk["queue"]["submit"]>>> {
      const result = await client.queue.submit(endpointId, options as any);
      return result;
    },

    async queueStatus(
      endpointId: string,
      options: Parameters<FalSdk["queue"]["status"]>[1],
    ): Promise<Awaited<ReturnType<FalSdk["queue"]["status"]>>> {
      const result = await client.queue.status(endpointId, options);
      return result;
    },

    async queueResult(
      endpointId: string,
      options: Parameters<FalSdk["queue"]["result"]>[1],
    ): Promise<Awaited<ReturnType<FalSdk["queue"]["result"]>>> {
      const result = await client.queue.result(endpointId, options as any);
      return result;
    },

    async queueCancel(
      endpointId: string,
      options: Parameters<FalSdk["queue"]["cancel"]>[1],
    ): Promise<void> {
      await client.queue.cancel(endpointId, options);
    },
  };
}
