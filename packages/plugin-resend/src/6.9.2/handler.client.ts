import type { Interpreter, RuntimeEntry } from "@mvfm/core";

/**
 * Options for the client-side interpreter.
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
 * Creates a client-side interpreter that proxies all operations to a server.
 *
 * Each handler yields child indices to resolve them via fold, then sends
 * the resolved data to `{baseUrl}/mvfm/execute` as a JSON POST.
 *
 * @param options - Handler options.
 * @param nodeKinds - Node kinds to create handlers for.
 * @returns An Interpreter that proxies all operations to the server.
 */
export function clientInterpreter(options: ClientHandlerOptions, nodeKinds: string[]): Interpreter {
  const { baseUrl, contractHash, headers = {} } = options;
  const fetchFn = options.fetch ?? globalThis.fetch;
  let stepIndex = 0;

  const interp: Interpreter = {};
  for (const kind of nodeKinds) {
    interp[kind] = async function* (entry: RuntimeEntry) {
      const resolved: Record<string, unknown> = { kind };
      for (let i = 0; i < entry.children.length; i++) {
        resolved[`child_${i}`] = yield i;
      }

      const response = await fetchFn(`${baseUrl}/mvfm/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          contractHash,
          stepIndex: stepIndex++,
          kind,
          data: resolved,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Client handler: server returned ${response.status}: ${text}`);
      }

      return ((await response.json()) as { result: unknown }).result;
    };
  }

  return interp;
}
