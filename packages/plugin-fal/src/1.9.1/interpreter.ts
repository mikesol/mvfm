import type {
  FalClient as FalSdkClient,
  QueueClient as FalSdkQueueClient,
  QueueStatus,
  Result,
} from "@fal-ai/client";
import type { Interpreter, RuntimeEntry } from "@mvfm/core";
import { wrapFalSdk } from "./client-fal-sdk";

/**
 * Fal client interface consumed by the fal handler.
 *
 * Abstracts over the actual `@fal-ai/client` so handlers can be
 * tested with mock clients.
 */
export interface FalClient {
  /** Execute an endpoint synchronously. */
  run(endpointId: string, options?: Parameters<FalSdkClient["run"]>[1]): Promise<Result<unknown>>;
  /** Subscribe to an endpoint (queue submit + poll + result). */
  subscribe(
    endpointId: string,
    options?: Parameters<FalSdkClient["subscribe"]>[1],
  ): Promise<Result<unknown>>;
  /** Submit a request to the queue. */
  queueSubmit(
    endpointId: string,
    options: Parameters<FalSdkQueueClient["submit"]>[1],
  ): Promise<unknown>;
  /** Check the status of a queued request. */
  queueStatus(
    endpointId: string,
    options: Parameters<FalSdkQueueClient["status"]>[1],
  ): Promise<QueueStatus>;
  /** Retrieve the result of a completed queued request. */
  queueResult(
    endpointId: string,
    options: Parameters<FalSdkQueueClient["result"]>[1],
  ): Promise<unknown>;
  /** Cancel a queued request. */
  queueCancel(
    endpointId: string,
    options: Parameters<FalSdkQueueClient["cancel"]>[1],
  ): Promise<void>;
}

/**
 * Creates an interpreter for `fal/*` node kinds using the new
 * RuntimeEntry + positional yield pattern.
 *
 * Config (credentials) is captured in the closure,
 * not stored on AST nodes.
 *
 * @param client - The {@link FalClient} to execute against.
 * @returns An Interpreter handling all fal node kinds.
 */
export function createFalInterpreter(client: FalClient): Interpreter {
  return {
    "fal/run": async function* (entry: RuntimeEntry) {
      const endpointId = (yield 0) as string;
      const options =
        entry.children.length > 1 ? ((yield 1) as Parameters<FalSdkClient["run"]>[1]) : undefined;
      return await client.run(endpointId, options);
    },

    "fal/subscribe": async function* (entry: RuntimeEntry) {
      const endpointId = (yield 0) as string;
      const options =
        entry.children.length > 1
          ? ((yield 1) as Parameters<FalSdkClient["subscribe"]>[1])
          : undefined;
      return await client.subscribe(endpointId, options);
    },

    "fal/queue_submit": async function* (_entry: RuntimeEntry) {
      const endpointId = (yield 0) as string;
      const options = (yield 1) as Parameters<FalSdkQueueClient["submit"]>[1];
      return await client.queueSubmit(endpointId, options);
    },

    "fal/queue_status": async function* (_entry: RuntimeEntry) {
      const endpointId = (yield 0) as string;
      const options = (yield 1) as Parameters<FalSdkQueueClient["status"]>[1];
      return await client.queueStatus(endpointId, options);
    },

    "fal/queue_result": async function* (_entry: RuntimeEntry) {
      const endpointId = (yield 0) as string;
      const options = (yield 1) as Parameters<FalSdkQueueClient["result"]>[1];
      return await client.queueResult(endpointId, options);
    },

    "fal/queue_cancel": async function* (_entry: RuntimeEntry) {
      const endpointId = (yield 0) as string;
      const options = (yield 1) as Parameters<FalSdkQueueClient["cancel"]>[1];
      await client.queueCancel(endpointId, options);
      return undefined;
    },

    "fal/record": async function* (entry: RuntimeEntry) {
      const result: Record<string, unknown> = {};
      for (let i = 0; i < entry.children.length; i += 2) {
        const key = (yield i) as string;
        const value = yield i + 1;
        result[key] = value;
      }
      return result;
    },

    "fal/array": async function* (entry: RuntimeEntry) {
      const result: unknown[] = [];
      for (let i = 0; i < entry.children.length; i++) {
        result.push(yield i);
      }
      return result;
    },
  };
}

function requiredEnv(name: "FAL_KEY"): string {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  const value = env?.[name];
  if (!value) {
    throw new Error(
      `@mvfm/plugin-fal: missing ${name}. Set ${name} or use createFalInterpreter(...)`,
    );
  }
  return value;
}

const dynamicImport = new Function("m", "return import(m)") as (
  moduleName: string,
) => Promise<Record<string, unknown>>;

function lazyInterpreter(factory: () => Interpreter): Interpreter {
  let cached: Interpreter | undefined;
  const get = () => (cached ??= factory());
  return new Proxy({} as Interpreter, {
    get(_target, property) {
      return get()[property as keyof Interpreter];
    },
    has(_target, property) {
      return property in get();
    },
    ownKeys() {
      return Reflect.ownKeys(get());
    },
    getOwnPropertyDescriptor(_target, property) {
      const descriptor = Object.getOwnPropertyDescriptor(get(), property);
      return descriptor
        ? descriptor
        : { configurable: true, enumerable: true, writable: false, value: undefined };
    },
  });
}

/**
 * Default Fal interpreter that uses `FAL_KEY`.
 */
export const falInterpreter: Interpreter = lazyInterpreter(() => {
  let clientPromise: Promise<FalClient> | undefined;
  const getClient = async (): Promise<FalClient> => {
    if (!clientPromise) {
      const credentials = requiredEnv("FAL_KEY");
      clientPromise = dynamicImport("@fal-ai/client").then((moduleValue) => {
        const falClient = moduleValue.fal as FalSdkClient;
        (falClient as unknown as { config: (o: { credentials: string }) => void }).config({
          credentials,
        });
        return wrapFalSdk(falClient);
      });
    }
    return clientPromise;
  };

  return createFalInterpreter({
    async run(endpointId, options) {
      const c = await getClient();
      return c.run(endpointId, options);
    },
    async subscribe(endpointId, options) {
      const c = await getClient();
      return c.subscribe(endpointId, options);
    },
    async queueSubmit(endpointId, options) {
      const c = await getClient();
      return c.queueSubmit(endpointId, options);
    },
    async queueStatus(endpointId, options) {
      const c = await getClient();
      return c.queueStatus(endpointId, options);
    },
    async queueResult(endpointId, options) {
      const c = await getClient();
      return c.queueResult(endpointId, options);
    },
    async queueCancel(endpointId, options) {
      const c = await getClient();
      await c.queueCancel(endpointId, options);
    },
  });
});
