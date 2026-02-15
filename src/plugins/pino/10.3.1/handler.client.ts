import type { StepContext, StepEffect, StepHandler } from "../../../core";

/**
 * Options for configuring the client-side handler.
 */
export interface ClientHandlerOptions {
  /** Base URL of the server endpoint (e.g., "https://api.example.com"). */
  baseUrl: string;
  /** Contract hash from the program, used for verification. */
  contractHash: string;
  /** Custom fetch implementation (defaults to global fetch). */
  fetch?: typeof globalThis.fetch;
  /** Additional headers to include in requests. */
  headers?: Record<string, string>;
}

/**
 * State tracked by the client handler across steps.
 */
export interface ClientHandlerState {
  /** The current step index, incremented after each effect. */
  stepIndex: number;
}

/**
 * Creates a client-side {@link StepHandler} that sends pino effects as JSON
 * to a remote server endpoint for execution.
 *
 * @param options - Configuration for the client handler.
 * @returns A {@link StepHandler} that tracks step indices.
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
