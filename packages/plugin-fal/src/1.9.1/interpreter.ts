import type {
  FalClient as FalSdkClient,
  QueueClient as FalSdkQueueClient,
  QueueStatus,
  Result,
} from "@fal-ai/client";
import type { Interpreter, TypedNode } from "@mvfm/core";
import { defineInterpreter, eval_ } from "@mvfm/core";
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

interface FalNode<K extends string, T> extends TypedNode<T> {
  kind: K;
  endpointId: TypedNode<string>;
  options?: TypedNode<unknown>;
}

interface FalRunNode extends FalNode<"fal/run", Result<unknown>> {}
interface FalSubscribeNode extends FalNode<"fal/subscribe", Result<unknown>> {}
interface FalQueueSubmitNode extends FalNode<"fal/queue_submit", unknown> {}
interface FalQueueStatusNode extends FalNode<"fal/queue_status", QueueStatus> {}
interface FalQueueResultNode extends FalNode<"fal/queue_result", unknown> {}
interface FalQueueCancelNode extends FalNode<"fal/queue_cancel", void> {}

declare module "@mvfm/core" {
  interface NodeTypeMap {
    "fal/run": FalRunNode;
    "fal/subscribe": FalSubscribeNode;
    "fal/queue_submit": FalQueueSubmitNode;
    "fal/queue_status": FalQueueStatusNode;
    "fal/queue_result": FalQueueResultNode;
    "fal/queue_cancel": FalQueueCancelNode;
  }
}

/**
 * Creates an interpreter for `fal/*` node kinds.
 *
 * @param client - The {@link FalClient} to execute against.
 * @returns An Interpreter handling all fal node kinds.
 */
export function createFalInterpreter(client: FalClient): Interpreter {
  return defineInterpreter<
    | "fal/run"
    | "fal/subscribe"
    | "fal/queue_submit"
    | "fal/queue_status"
    | "fal/queue_result"
    | "fal/queue_cancel"
  >()({
    "fal/run": async function* (node: FalRunNode) {
      const endpointId = yield* eval_(node.endpointId);
      const options = node.options != null ? yield* eval_(node.options) : undefined;
      return await client.run(endpointId, options as any);
    },

    "fal/subscribe": async function* (node: FalSubscribeNode) {
      const endpointId = yield* eval_(node.endpointId);
      const options = node.options != null ? yield* eval_(node.options) : undefined;
      return await client.subscribe(endpointId, options as any);
    },

    "fal/queue_submit": async function* (node: FalQueueSubmitNode) {
      const endpointId = yield* eval_(node.endpointId);
      const options = node.options != null ? yield* eval_(node.options) : undefined;
      return await client.queueSubmit(endpointId, options as any);
    },

    "fal/queue_status": async function* (node: FalQueueStatusNode) {
      const endpointId = yield* eval_(node.endpointId);
      const options = node.options != null ? yield* eval_(node.options) : undefined;
      return await client.queueStatus(endpointId, options as any);
    },

    "fal/queue_result": async function* (node: FalQueueResultNode) {
      const endpointId = yield* eval_(node.endpointId);
      const options = node.options != null ? yield* eval_(node.options) : undefined;
      return await client.queueResult(endpointId, options as any);
    },

    "fal/queue_cancel": async function* (node: FalQueueCancelNode) {
      const endpointId = yield* eval_(node.endpointId);
      const options = node.options != null ? yield* eval_(node.options) : undefined;
      await client.queueCancel(endpointId, options as any);
      return undefined;
    },
  });
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

const dynamicImport = new Function("m", "return import(m)") as (moduleName: string) => Promise<any>;

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
        const falClient = moduleValue.fal;
        falClient.config({ credentials });
        return wrapFalSdk(falClient);
      });
    }
    return clientPromise;
  };

  return createFalInterpreter({
    async run(
      endpointId: string,
      options?: Parameters<FalSdkClient["run"]>[1],
    ): Promise<Result<unknown>> {
      const client = await getClient();
      return client.run(endpointId, options);
    },
    async subscribe(
      endpointId: string,
      options?: Parameters<FalSdkClient["subscribe"]>[1],
    ): Promise<Result<unknown>> {
      const client = await getClient();
      return client.subscribe(endpointId, options);
    },
    async queueSubmit(
      endpointId: string,
      options: Parameters<FalSdkQueueClient["submit"]>[1],
    ): Promise<unknown> {
      const client = await getClient();
      return client.queueSubmit(endpointId, options);
    },
    async queueStatus(
      endpointId: string,
      options: Parameters<FalSdkQueueClient["status"]>[1],
    ): Promise<QueueStatus> {
      const client = await getClient();
      return client.queueStatus(endpointId, options);
    },
    async queueResult(
      endpointId: string,
      options: Parameters<FalSdkQueueClient["result"]>[1],
    ): Promise<unknown> {
      const client = await getClient();
      return client.queueResult(endpointId, options);
    },
    async queueCancel(
      endpointId: string,
      options: Parameters<FalSdkQueueClient["cancel"]>[1],
    ): Promise<void> {
      const client = await getClient();
      await client.queueCancel(endpointId, options);
    },
  });
});
