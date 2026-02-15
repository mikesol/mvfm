import type { ASTNode, InterpreterFragment, StepHandler } from "../../../core";
import { runAST } from "../../../core";
import type { FetchClient } from "./interpreter";

/**
 * Creates a server-side {@link StepHandler} that executes fetch effects
 * against a real fetch client.
 *
 * Handles two effect types:
 * - `fetch/http_request`: executes the HTTP request via `client.request()`
 * - `fetch/read_body`: reads the response body/metadata using the specified mode
 *
 * @param client - The {@link FetchClient} to execute against.
 * @returns A {@link StepHandler} for void state.
 */
export function serverHandler(client: FetchClient): StepHandler<void> {
  return async (effect, _context, state) => {
    if (effect.type === "fetch/http_request") {
      const { url, init, config } = effect as {
        type: "fetch/http_request";
        url: string;
        init?: RequestInit;
        config?: { baseUrl?: string; defaultHeaders?: Record<string, string> };
      };

      // Apply config: prepend baseUrl, merge defaultHeaders
      let resolvedUrl = url;
      if (config?.baseUrl && !url.startsWith("http://") && !url.startsWith("https://")) {
        resolvedUrl = `${config.baseUrl.replace(/\/$/, "")}/${url.replace(/^\//, "")}`;
      }

      const mergedInit: RequestInit = { ...init };
      if (config?.defaultHeaders) {
        mergedInit.headers = {
          ...config.defaultHeaders,
          ...(init?.headers as Record<string, string> | undefined),
        };
      }

      const response = await client.request(resolvedUrl, mergedInit);
      return { value: response, state };
    }

    if (effect.type === "fetch/read_body") {
      const { response, mode } = effect as {
        type: "fetch/read_body";
        response: Response;
        mode: "json" | "text" | "status" | "headers";
      };

      let value: unknown;
      switch (mode) {
        case "json":
          value = await response.json();
          break;
        case "text":
          value = await response.text();
          break;
        case "status":
          value = response.status;
          break;
        case "headers": {
          const headers: Record<string, string> = {};
          response.headers.forEach((v, k) => {
            headers[k] = v;
          });
          value = headers;
          break;
        }
        default:
          throw new Error(`serverHandler: unknown read_body mode "${mode}"`);
      }
      return { value, state };
    }

    throw new Error(`serverHandler: unhandled effect type "${effect.type}"`);
  };
}

/**
 * Creates a unified evaluation function that evaluates an AST against
 * a fetch client using the provided interpreter fragments.
 *
 * Convenience wrapper composing fragments + {@link serverHandler} via `runAST`.
 *
 * @param client - The {@link FetchClient} to execute against.
 * @param fragments - Generator interpreter fragments for evaluating sub-expressions.
 * @returns An async function that evaluates an AST node to its result.
 */
export function serverEvaluate(
  client: FetchClient,
  fragments: InterpreterFragment[],
): (root: ASTNode) => Promise<unknown> {
  return async (root: ASTNode): Promise<unknown> => {
    const { value } = await runAST(root, fragments, serverHandler(client), undefined);
    return value;
  };
}
