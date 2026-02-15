import type { StepContext, StepEffect, StepHandler } from "@mvfm/core";

/**
 * Options for the client-side console handler.
 */
export interface ClientHandlerOptions {
  /** Base URL for remote execution endpoint. */
  baseUrl: string;
  /** Contract hash from compiled program metadata. */
  contractHash: string;
  /** Optional fetch override. */
  fetch?: typeof globalThis.fetch;
  /** Optional extra request headers. */
  headers?: Record<string, string>;
}

/**
 * Mutable state carried by the client handler.
 */
export interface ClientHandlerState {
  /** Current step index. */
  stepIndex: number;
}

/**
 * Creates a client-side handler that proxies console effects to a server.
 *
 * @param options - Handler options.
 * @returns A step handler that increments step index per request.
 */
export function clientHandler(options: ClientHandlerOptions): StepHandler<ClientHandlerState> {
  const { baseUrl, contractHash, headers = {} } = options;
  const fetchFn = options.fetch ?? globalThis.fetch;

  return async (
    effect: StepEffect,
    context: StepContext,
    state: ClientHandlerState,
  ): Promise<{ value: unknown; state: ClientHandlerState }> => {
    const response = await fetchFn(`${baseUrl}/mvfm/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify({
        contractHash,
        stepIndex: state.stepIndex,
        path: context.path,
        effect,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Client handler: server returned ${response.status}: ${text}`);
    }

    const data = (await response.json()) as { result: unknown };

    return {
      value: data.result,
      state: { stepIndex: state.stepIndex + 1 },
    };
  };
}
