import type { Interpreter, TypedNode } from "@mvfm/core";
import { eval_ } from "@mvfm/core";

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
 * Each handler resolves its TypedNode children via `eval_()`, then sends
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
    interp[kind] = async function* (node: TypedNode) {
      const resolved: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(node as unknown as Record<string, unknown>)) {
        if (key === "__T") continue;
        if (val && typeof val === "object" && "kind" in (val as object)) {
          resolved[key] = yield* eval_(val as TypedNode);
        } else if (Array.isArray(val)) {
          const arr: unknown[] = [];
          for (const item of val) {
            if (item && typeof item === "object" && "kind" in (item as object)) {
              arr.push(yield* eval_(item as TypedNode));
            } else {
              arr.push(item);
            }
          }
          resolved[key] = arr;
        } else {
          resolved[key] = val;
        }
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
